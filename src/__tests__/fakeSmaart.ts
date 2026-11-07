import type { AddressInfo } from 'node:net'
import { WebSocketServer, type WebSocket } from 'ws'

/** A request as the fake received it */
export type Received = { sequenceNumber?: number; action?: string; target?: unknown; properties?: unknown[] }

/** What the fake sends back to a request, or undefined to send nothing */
export type Responder = (request: Received, fake: FakeSmaart) => object | string | undefined

/**
 * A stand-in for the Smaart API V3 WebSocket server.
 *
 * Synthetic: no capture from Smaart was available. The replies are what the module before the TypeScript conversion
 * expected of the API: `{ sequenceNumber, response }`, with `response.authenticationRequired` in the reply to the
 * login request and `response.error` holding an error id.
 */
export class FakeSmaart {
	readonly #server: WebSocketServer
	/** Every request, by connection, in the order received */
	readonly requests: Received[][] = []
	/** The path each connection asked for */
	readonly paths: string[] = []
	readonly sockets: WebSocket[] = []
	/** The password the API asks for, or undefined for none */
	password: string | undefined
	respond: Responder = defaultResponder

	private constructor(server: WebSocketServer) {
		this.#server = server
		server.on('connection', (socket, request) => {
			const index = this.sockets.length
			this.sockets.push(socket)
			this.paths.push(request.url ?? '')
			this.requests.push([])
			socket.on('message', (data) => {
				// Text frames arrive as a Buffer, ws's default binaryType
				const parsed = JSON.parse((data as Buffer).toString('utf8')) as Received
				this.requests[index].push(parsed)
				const reply = this.respond(parsed, this)
				if (reply !== undefined) socket.send(typeof reply === 'string' ? reply : JSON.stringify(reply))
			})
		})
	}

	static async start(): Promise<FakeSmaart> {
		const server = new WebSocketServer({ host: '127.0.0.1', port: 0 })
		await new Promise<void>((resolve, reject) => {
			server.once('listening', resolve)
			server.once('error', reject)
		})
		return new FakeSmaart(server)
	}

	get port(): number {
		return (this.#server.address() as AddressInfo).port
	}

	/** Connections still open */
	get openSockets(): WebSocket[] {
		return this.sockets.filter((socket) => socket.readyState === socket.OPEN)
	}

	/** Every request on every connection, in the order received */
	get allRequests(): Received[] {
		return this.requests.flat()
	}

	/** Sends a message to every open connection, as if Smaart had */
	broadcast(message: object | string): void {
		for (const socket of this.openSockets) socket.send(typeof message === 'string' ? message : JSON.stringify(message))
	}

	async close(): Promise<void> {
		for (const socket of this.sockets) socket.terminate()
		await new Promise<void>((resolve) => this.#server.close(() => resolve()))
	}
}

/**
 * Asks for the password in reply to the login request, if there is one, and answers everything else with an empty
 * response, or an error for a wrong password
 */
export const defaultResponder: Responder = (request, fake) => {
	const { sequenceNumber } = request
	if (sequenceNumber === 1 && request.action === 'get') {
		return { sequenceNumber, response: { authenticationRequired: fake.password !== undefined } }
	}
	const password = (request.properties?.[0] as { password?: unknown } | undefined)?.password
	if (password !== undefined && password !== fake.password) {
		return { sequenceNumber, response: { error: 'incorrect password' } }
	}
	return { sequenceNumber, response: {} }
}
