import { InstanceBase, runEntrypoint, InstanceStatus, Regex } from '@companion-module/base'
import UpdateActions from './actions.js'
import { errors } from './errors.js'
import UpdateFeedbacks from './feedbacks.js'
import UpgradeScripts from './upgrades.js'
import UpdateVariableDefinitions from './variables.js'
import PQueue from 'p-queue'

const RECONNECT_TIMEOUT = 10 // Number of seconds to try reconnect
const queue = new PQueue({ concurrency: 1, interval: 10, intervalCap: 1 })

class SmaartV3 extends InstanceBase {
	constructor(internal) {
		super(internal)
		this.reconnecting = null
		this.closing = false
		this.moduleStatus = {
			currentStatus: null,
			message: '',
		}
	}

	/**
	 * Main initialization when it's ok to login
	 * @param {Object} config New configuration
	 * @access public
	 * @since 1.0.0
	 */

	async init(config) {
		this.configUpdated(config)
		this.updateActions() // export actions
		this.updateFeedbacks() // export feedbacks
		this.updateVariableDefinitions() // export variable definitions
	}

	/**
	 * Ends session if connected
	 * @since 1.0.0
	 */
	async destroy() {
		this.log('debug', `destroy ${this.id}:${this.label}`)
		if (this.keepAlive) {
			clearTimeout(this.keepAlive)
		}
		queue.clear()
		this.logout()
	}

	/**
	 * Process configuration updates
	 * @param {Object} config New configuration
	 * @access public
	 * @since 1.0.0
	 */

	async configUpdated(config) {
		if (this.keepAlive) {
			clearTimeout(this.keepAlive)
		}
		queue.clear()
		this.config = config

		this.checkStatus(InstanceStatus.Connecting)

		this.logout()
		if (config.host && config.port) {
			this.login(config.host, config.port, config.password)
		}
	}

	/**
	 * Debouce status updates
	 * @param {InstanceStatus} status
	 * @param {string} message
	 * @access private
	 * @since 2.1.0
	 */

	checkStatus(status, message) {
		if (this.moduleStatus.currentStatus === status && this.moduleStatus.message == message) return
		this.updateStatus(status, message)
		this.moduleStatus.currentStatus = status
		this.moduleStatus.message = message
	}

	/**
	 * Configuration fields that can be used
	 * @returns {Array}
	 * @access public
	 * @since 1.0.0
	 */

	getConfigFields() {
		return [
			{
				type: 'static-text',
				id: 'info',
				width: 12,
				label: 'Information',
				value:
					'This will connect with Rational Acoustics Smaart server.<br> If using Smaart V9 or newer this module will not work!<br> Set the API Command Timeout to > 2000ms to avoid reconnect events',
			},
			{
				type: 'textinput',
				id: 'host',
				label: 'Target IP/ Hostname',
				width: 12,
				regex: Regex.HOSTNAME | Regex.IP,
				default: 'localhost',
			},
			{
				type: 'textinput',
				id: 'port',
				label: 'Target Port',
				width: 12,
				regex: Regex.PORT,
				default: '26000',
			},
			{
				type: 'textinput',
				id: 'password',
				label: 'Password',
				width: 6,
				tooltip: 'If authentication is not used leave password blank',
			},
		]
	}

	/**
	 * Login to the device
	 * @param {string} host Host to connect to
	 * @param {string} port Port to connect on
	 * @access public
	 * @since 1.0.0
	 */
	login(host, port, password) {
		this.logout()

		this.closing = false

		if (this.reconnecting) {
			clearTimeout(this.reconnecting)
			this.reconnecting = null
		}

		// Connect to remote control websocket of Smaart
		this.socket = new WebSocket('ws://' + host + ':' + parseInt(port) + '/api/v3/')
		this.checkStatus(InstanceStatus.Connecting)
		this.socket.addEventListener('open', () => {
			this.checkStatus(InstanceStatus.Ok)
			this.log('info', `Connected to ws://${host}:${port}/`)
			this.sendData({
				sequenceNumber: 1,
				action: 'get',
			})
		})

		this.socket.addEventListener('error', (err) => {
			this.log('error', JSON.stringify(err))
			this.checkStatus(InstanceStatus.ConnectionFailure, err.message)
		})

		this.socket.addEventListener('close', (event) => {
			this.checkStatus(InstanceStatus.ConnectionFailure, 'Disconnected from Smaart')
			this.log('warn', `Socket Closed ${event.code} ${event.reason}`)
			if (!this.closing) {
				this.keep_login_retry(RECONNECT_TIMEOUT)
			}
		})

		this.socket.addEventListener('message', async (message) => {
			//this.log('debug', `message recieved: ${JSON.stringify(message)}`)
			if (message.data !== undefined) {
				try {
					const jsonMsg = JSON.parse(message.data)
					this.log('debug', `Parsed Message: ${JSON.stringify(jsonMsg)}`)
					if (jsonMsg?.response?.error !== undefined) {
						for (const error of errors) {
							if (jsonMsg.response.error === error.id) {
								this.log(error.logLevel, error.description)
								this.checkStatus(error.status, error.statusDescription)
								break
							}
						}
					} else {
						this.checkStatus(InstanceStatus.Ok)

						if (jsonMsg?.sequenceNumber === 1 && jsonMsg?.response?.authenticationRequired) {
							this.log('info', 'Authenticating')
							await this.sendData({
								action: 'set',
								properties: [
									{
										password: password,
									},
								],
							})
						}
					}
				} catch (e) {
					this.checkStatus(InstanceStatus.UnknownWarning)
					this.log('warn', `Parsing Error. ${JSON.stringify(e)}`)
				}
			}
		})
	}

	/**
	 * Try login again after timeout
	 * @param {number} timeout Timeout in seconds to try reconnection
	 * @access public
	 * @since 1.0.0
	 */
	keep_login_retry(timeout = RECONNECT_TIMEOUT) {
		if (this.reconnecting) {
			return
		}

		this.log('info', 'Attempting to reconnect in ' + timeout + ' seconds.')
		this.reconnecting = setTimeout(() => {
			this.login(this.config.host, this.config.port, this.config.password)
		}, timeout * 1000)
	}

	/**
	 * Logout of smaart
	 * @access public
	 * @since 1.0.0
	 */
	logout() {
		this.closing = true
		if (this.reconnecting) {
			clearTimeout(this.reconnecting)
			this.reconnecting = null
		}

		if (this.socket !== undefined) {
			// Disconnect if already connected
			if (this.socket?.readyState === WebSocket.OPEN || this.socket?.readyState === WebSocket.CONNECTING) {
				this.socket.close(1000)
			}
			delete this.socket
		}
	}

	/**
	 * Sequence number generator
	 * @returns {number} new sequence number
	 * @access private
	 * @since 2.1.0
	 */

	sequenceNumber() {
		if (this.sequence === undefined) this.sequence = 2
		this.sequence = this.sequence < 0xffff ? this.sequence + 1 : 2
		return this.sequence
	}

	/**
	 * Start timer to send keepalive message
	 * @access private
	 * @since 2.1.0
	 */

	startKeepAlive() {
		if (this.keepAlive) {
			clearTimeout(this.keepAlive)
		}
		this.keepAlive = setTimeout(() => {
			this.sendData({
				//sequenceNumber: 1,
				action: 'get',
			})
			delete this.keepAlive
		}, 1000)
	}

	/**
	 * Send data on websocket connection
	 * @param {object} jsonPayload object to send as json serialised data
	 * @access public
	 * @since 1.0.0
	 */

	async sendData(jsonPayload) {
		await queue.add(() => {
			if (this.socket != undefined && this.socket.readyState === WebSocket.OPEN) {
				jsonPayload.sequenceNumber = jsonPayload.sequenceNumber ?? this.sequenceNumber()
				this.socket.send(JSON.stringify(jsonPayload))
				this.startKeepAlive()
			} else {
				this.log('warn', `Not connected! Tried to send:\n${JSON.stringify(jsonPayload)}`)
			}
		})
	}

	/**
	 * Sends command to reset averages
	 * @access public
	 * @since 1.0.0
	 */
	async resetAvg() {
		const payload = {
			//sequenceNumber: 10,
			action: 'set',
			target: 'activeMeasurements',
			properties: [
				{
					runningAverage: 0,
				},
			],
		}

		await this.sendData(payload)
	}

	/**
	 * Sends command to change tabs
	 * @param {string} tabName
	 * @access public
	 * @since 1.0.0
	 */
	async selectTab(tabName) {
		const payload = {
			//sequenceNumber: 11,
			action: 'set',
			target: 'tabs',
			properties: [
				{
					activeTab: tabName,
				},
			],
		}

		await this.sendData(payload)
	}

	/**
	 * Sends command to start all measurments on a tab
	 * @param {string} tabName
	 * @access public
	 * @since 1.0.0
	 */
	async startAllMeasurements(tabName) {
		const payload = {
			//sequenceNumber: 12,
			action: 'set',
			target: {
				tabName: tabName,
				measurementName: 'allMeasurements',
			},
			properties: [{ active: true }],
		}

		await this.sendData(payload)
	}

	/**
	 * Sends command to turn the generator on or off
	 * @param {boolean} state
	 * @access public
	 * @since 1.0.0
	 */
	async generatorState(state) {
		const payload = {
			//sequenceNumber: 13,
			action: 'set',
			target: 'signalGenerator',
			properties: [{ active: state }],
		}

		await this.sendData(payload)
	}

	/**
	 * Sends command to set the generator level
	 * @param {number} level
	 * @access public
	 * @since 1.0.0
	 */
	async setGeneratorLevel(level) {
		const payload = {
			//sequenceNumber: 14,
			action: 'set',
			target: 'signalGenerator',
			properties: [{ gain: level }],
		}

		await this.sendData(payload)
	}

	/**
	 * Sends command to turn tracking for an entire tab on or off
	 * @param {boolean} state
	 * @access public
	 * @since 1.0.0
	 */
	async trackingState(state) {
		const payload = {
			//sequenceNumber: 15,
			action: 'set',
			target: {
				measurementName: 'allTransferFunctionMeasurements',
			},
			properties: [{ trackingDelay: state }],
		}
		await this.sendData(payload)
	}

	/**
	 * Sends command to capture current trace
	 * @param {string} traceName
	 * @access public
	 * @since 2.0.0
	 */

	async captureTrace(traceName) {
		const payload = {
			//sequenceNumber: 42,
			action: 'capture',
			target: {
				measurementName: traceName,
			},
		}
		this.log('debug', `captureTrace: ${JSON.stringify(payload)}`)
		await this.sendData(payload)
	}

	/**
	 * Sends command to capture current trace
	 * @param {string} traceName
	 * @param {string} tracePath
	 * @access public
	 * @since 2.0.0
	 */

	async renameTrace(traceName, tracePath) {
		const payload = {
			//sequenceNumber: 42,
			action: 'set',
			target: {
				traceFilePath: tracePath,
			},
			properties: [{ name: traceName }],
		}
		this.log('debug', `renameTrace: ${JSON.stringify(payload)}`)
		await this.sendData(payload)
	}

	/**
	 * Sends command to issueCommand handler
	 * @param {string} command
	 * @access public
	 * @since 1.0.0
	 */
	async issueCommand(command) {
		const payload = {
			//sequenceNumber: 16,
			action: 'issueCommand',
			properties: [{ keypress: command }],
		}
		this.log('debug', `issueCommand: ${JSON.stringify(payload)}`)
		await this.sendData(payload)
	}

	updateActions() {
		UpdateActions(this)
	}

	updateFeedbacks() {
		UpdateFeedbacks(this)
	}

	updateVariableDefinitions() {
		UpdateVariableDefinitions(this)
	}
}

runEntrypoint(SmaartV3, UpgradeScripts)
