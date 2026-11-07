import { InstanceBase, InstanceStatus, type SomeCompanionConfigField } from '@companion-module/base'
import { GetConfigFields, loginPassword, validPort, type ModuleConfig, type ModuleSecrets } from './config.js'
import { UpgradeScripts } from './upgrades.js'
import { UpdateActions, type ActionSchema } from './actions.js'
import { SmaartConnection, validHost, type ConnectionTiming } from './connection.js'
import type { SmaartRequest } from './requests.js'

export type ModuleTypes = {
	config: ModuleConfig
	secrets: ModuleSecrets
	actions: ActionSchema
	feedbacks: Record<string, never>
	variables: Record<string, never>
}

export { UpgradeScripts }

export default class SmaartInstance extends InstanceBase<ModuleTypes> {
	config!: ModuleConfig // Setup in init()
	/** Overrides the connection's timing. Tests shorten it */
	timing: Partial<ConnectionTiming> | undefined
	#connection: SmaartConnection | undefined

	async init(config: ModuleConfig, _isFirstInit: boolean, secrets: ModuleSecrets | undefined): Promise<void> {
		UpdateActions(this)
		await this.configUpdated(config, secrets)
	}

	async configUpdated(config: ModuleConfig, secrets: ModuleSecrets | undefined): Promise<void> {
		this.config = config
		this.#close()
		this.#open(loginPassword(secrets))
	}

	// When module gets deleted
	async destroy(): Promise<void> {
		this.log('debug', `destroy. ID: ${this.id}`)
		this.#close()
	}

	getConfigFields(): SomeCompanionConfigField[] {
		return GetConfigFields()
	}

	/**
	 * Queues a request for Smaart
	 * @param signal an action's context.signal, so a request the user no longer wants is dropped before it is sent
	 * @throws if not connected, or the request is not sent
	 */
	async send(request: SmaartRequest, signal?: AbortSignal): Promise<void> {
		if (this.#connection === undefined) throw new Error('Not connected to Smaart')
		await this.#connection.send(request, signal)
	}

	#open(password: string): void {
		const host = typeof this.config.host === 'string' ? this.config.host.trim() : ''
		const port = validPort(this.config.port)
		if (host === '') {
			this.updateStatus(InstanceStatus.BadConfig, 'No host')
			return
		}
		if (port === undefined) {
			this.updateStatus(InstanceStatus.BadConfig, `Invalid port ${String(this.config.port)}`)
			return
		}
		if (!validHost(host, port)) {
			this.updateStatus(InstanceStatus.BadConfig, `Invalid host ${host}`)
			return
		}
		const connection = new SmaartConnection({
			host,
			port,
			password,
			log: (level, message) => this.log(level, message),
			timing: this.timing,
		})
		connection.on('status', (status, message) => this.updateStatus(status, message))
		this.#connection = connection
		connection.connect()
	}

	#close(): void {
		this.#connection?.destroy()
		this.#connection = undefined
	}
}
