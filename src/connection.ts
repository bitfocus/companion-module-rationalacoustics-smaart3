import { EventEmitter } from 'node:events'
import { InstanceStatus, type LogLevel } from '@companion-module/base'
import PQueue from 'p-queue'
import { SMAART_ERRORS, unknownSmaartError } from './errors.js'
import {
	keepAliveRequest,
	LOGIN_SEQUENCE_NUMBER,
	loginRequest,
	passwordRequest,
	type SmaartRequest,
} from './requests.js'
import { SmaartMessageSchema, type SmaartMessage } from './schemas.js'
import { errorMessage } from './utils.js'

export interface ConnectionTiming {
	/** Least time from sending one request to sending the next */
	messageInterval: number
	/** A keepalive is sent once nothing else has been for this long */
	keepAliveInterval: number
	/** How long after the connection closes it is reopened */
	reconnectInterval: number
}

export const DEFAULT_TIMING: ConnectionTiming = {
	messageInterval: 10,
	keepAliveInterval: 1000,
	reconnectInterval: 10_000,
}

/** Sequence numbers count up to this, then start again */
const MAX_SEQUENCE_NUMBER = 0xffff

export interface ConnectionOptions {
	host: string
	port: number
	/** Empty if the API has none */
	password: string
	log: (level: LogLevel, message: string) => void
	/** Defaults to {@link DEFAULT_TIMING}. Tests shorten it */
	timing?: Partial<ConnectionTiming>
}

export interface ConnectionEvents {
	status: [status: InstanceStatus, message: string | null]
}

const API_PATH = '/api/v3/'

/** The API's address. An IPv6 address has to be bracketed in a URL */
export function apiUrl(host: string, port: number): string {
	const hostname = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host
	return `ws://${hostname}:${port}${API_PATH}`
}

/**
 * Whether the host makes a usable API address, parsed as the WebSocket will parse it. The WebSocket constructor throws
 * for a URL the parser rejects, or one with a fragment. A host holding '/', '?' or '@' parses, but as a path, query or
 * user name, and the connection would go somewhere other than the host typed.
 */
export function validHost(host: string, port: number): boolean {
	const url = URL.parse(apiUrl(host, port))
	return (
		url !== null &&
		url.pathname === API_PATH &&
		url.search === '' &&
		url.hash === '' &&
		url.username === '' &&
		url.password === ''
	)
}

/**
 * The WebSocket connection to the Smaart API V3: login, pacing, keepalive and reconnection. Knows nothing of Companion
 * beyond reporting a status for it.
 */
export class SmaartConnection extends EventEmitter<ConnectionEvents> {
	readonly #options: ConnectionOptions
	readonly #timing: ConnectionTiming
	readonly #url: string
	/** One per connection, so one instance being reconfigured can't drop what another has queued */
	readonly #queue: PQueue
	/** Aborted by destroy, which drops everything still queued */
	readonly #controller = new AbortController()
	#socket: WebSocket | undefined
	#reconnectTimer: NodeJS.Timeout | undefined
	#keepAliveTimer: NodeJS.Timeout | undefined
	/** The last one given out. {@link LOGIN_SEQUENCE_NUMBER} is kept for the login request, so its reply can be told */
	#sequenceNumber = LOGIN_SEQUENCE_NUMBER + 1
	#lastStatus: { status: InstanceStatus; message: string | null } | undefined
	#destroyed = false

	constructor(options: ConnectionOptions) {
		super()
		this.#options = options
		this.#timing = { ...DEFAULT_TIMING, ...options.timing }
		this.#url = apiUrl(options.host, options.port)
		this.#queue = new PQueue({ concurrency: 1, interval: this.#timing.messageInterval, intervalCap: 1 })
	}

	/** Opens the connection, replacing any already open. It is reopened whenever it closes, until destroyed */
	connect(): void {
		if (this.#destroyed) throw new Error('Connection has been destroyed')
		clearTimeout(this.#reconnectTimer)
		this.#reconnectTimer = undefined
		this.#closeSocket()
		this.#status(InstanceStatus.Connecting, null)
		const socket = new WebSocket(this.#url)
		this.#socket = socket
		// A socket being closed reports it some time later, by when its replacement may be open. Each handler checks it
		// is still for the current socket, or a socket closed by a config change would schedule a reconnect, and that
		// reconnect would close the new socket and schedule another, every reconnect interval from then on
		socket.addEventListener('open', () => {
			if (socket === this.#socket) this.#onOpen()
		})
		socket.addEventListener('error', () => {
			if (socket === this.#socket) this.#onError()
		})
		socket.addEventListener('close', (event) => {
			if (socket === this.#socket) this.#onClose(event)
		})
		socket.addEventListener('message', (event) => {
			if (socket === this.#socket) this.#onMessage(event.data)
		})
	}

	/** Closes the connection for good. Anything still queued is rejected */
	destroy(): void {
		this.#destroyed = true
		this.removeAllListeners()
		clearTimeout(this.#reconnectTimer)
		this.#stopKeepAlive()
		this.#controller.abort()
		this.#queue.clear()
		this.#closeSocket()
	}

	/**
	 * Queues a request for Smaart
	 * @param request given the next sequence number, unless it has one
	 * @param signal an action's context.signal. A request whose signal aborts before its turn is never sent
	 * @returns once the request is written to the socket
	 * @throws if not connected, or the connection is destroyed or the signal aborts before the request is sent
	 */
	async send(request: SmaartRequest, signal?: AbortSignal): Promise<void> {
		// p-queue listens on the combined signal from the moment the job is queued, which makes it pass an abort on
		// eagerly. Only reading .aborted could miss one: AbortSignal.any holds its sources weakly
		const combined = signal ? AbortSignal.any([this.#controller.signal, signal]) : this.#controller.signal
		await this.#queue.add(
			({ signal: jobSignal }) => {
				jobSignal?.throwIfAborted()
				const socket = this.#socket
				if (socket?.readyState !== WebSocket.OPEN) throw new Error('Not connected to Smaart')
				const message = JSON.stringify({
					...request,
					sequenceNumber: request.sequenceNumber ?? this.#nextSequenceNumber(),
				})
				socket.send(message)
				this.#options.log('debug', `Sent: ${message}`)
				this.#startKeepAlive()
			},
			{ signal: combined },
		)
	}

	/** Queues a request the connection sends of its own accord, logging rather than throwing if it can't be */
	#sendInternal(request: SmaartRequest): void {
		this.send(request).catch((err) => {
			if (!this.#destroyed) this.#options.log('debug', `${JSON.stringify(request)} not sent: ${errorMessage(err)}`)
		})
	}

	#nextSequenceNumber(): number {
		this.#sequenceNumber =
			this.#sequenceNumber < MAX_SEQUENCE_NUMBER ? this.#sequenceNumber + 1 : LOGIN_SEQUENCE_NUMBER + 1
		return this.#sequenceNumber
	}

	/** Restarted by every request sent, so a keepalive goes only once nothing else has for a while */
	#startKeepAlive(): void {
		clearTimeout(this.#keepAliveTimer)
		this.#keepAliveTimer = setTimeout(() => {
			this.#keepAliveTimer = undefined
			this.#sendInternal(keepAliveRequest())
		}, this.#timing.keepAliveInterval)
	}

	#stopKeepAlive(): void {
		clearTimeout(this.#keepAliveTimer)
		this.#keepAliveTimer = undefined
	}

	#closeSocket(): void {
		const socket = this.#socket
		this.#socket = undefined
		this.#stopKeepAlive()
		if (socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) socket.close(1000)
	}

	#onOpen(): void {
		this.#status(InstanceStatus.Ok, null)
		this.#options.log('info', `Connected to ${this.#url}`)
		this.#sendInternal(loginRequest())
	}

	/** The event says nothing of what went wrong. It is always followed by close, which reconnects */
	#onError(): void {
		this.#status(InstanceStatus.ConnectionFailure, 'Connection error')
		this.#options.log('error', `Connection error on ${this.#url}`)
	}

	#onClose(event: CloseEvent): void {
		this.#socket = undefined
		this.#stopKeepAlive()
		this.#status(InstanceStatus.ConnectionFailure, 'Disconnected from Smaart')
		this.#options.log('warn', `Socket Closed ${event.code} ${event.reason}`)
		this.#scheduleReconnect()
	}

	#scheduleReconnect(): void {
		if (this.#reconnectTimer !== undefined) return
		this.#options.log('info', `Attempting to reconnect in ${this.#timing.reconnectInterval / 1000} seconds.`)
		this.#reconnectTimer = setTimeout(() => {
			this.#reconnectTimer = undefined
			this.connect()
		}, this.#timing.reconnectInterval)
	}

	#onMessage(data: unknown): void {
		if (typeof data !== 'string') {
			this.#options.log('debug', 'Ignoring a binary message')
			return
		}
		this.#options.log('debug', `Message received: ${data}`)
		let json: unknown
		try {
			json = JSON.parse(data)
		} catch (err) {
			this.#parsingError(errorMessage(err))
			return
		}
		const parsed = SmaartMessageSchema.safeParse(json)
		if (!parsed.success) {
			this.#parsingError(parsed.error.message)
			return
		}
		this.#onReply(parsed.data)
	}

	#parsingError(detail: string): void {
		this.#status(InstanceStatus.UnknownWarning, 'Parsing Error')
		this.#options.log('warn', `Parsing Error. ${detail}`)
	}

	#onReply({ sequenceNumber, response }: SmaartMessage): void {
		if (response?.error !== undefined) {
			const error = SMAART_ERRORS[response.error] ?? unknownSmaartError(response.error)
			this.#options.log(error.logLevel, error.description)
			this.#status(error.status, error.statusDescription)
			return
		}
		this.#status(InstanceStatus.Ok, null)
		if (sequenceNumber === LOGIN_SEQUENCE_NUMBER && response?.authenticationRequired === true) {
			this.#options.log('info', 'Authenticating')
			this.#sendInternal(passwordRequest(this.#options.password))
		}
	}

	/** Reports a status, unless it is the one last reported. Smaart replies to a keepalive every second */
	#status(status: InstanceStatus, message: string | null): void {
		if (this.#lastStatus?.status === status && this.#lastStatus.message === message) return
		this.#lastStatus = { status, message }
		this.emit('status', status, message)
	}
}
