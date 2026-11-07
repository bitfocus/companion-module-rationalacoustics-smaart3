import { setTimeout as sleep } from 'node:timers/promises'
import { InstanceStatus, type LogLevel } from '@companion-module/base'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiUrl, SmaartConnection, validHost, type ConnectionTiming } from '../connection.js'
import { keypressRequest } from '../requests.js'
import { FakeSmaart } from './fakeSmaart.js'

/** No keepalives unless a test asks for them, so they don't land among the requests it checks */
const TIMING: ConnectionTiming = { messageInterval: 1, keepAliveInterval: 60_000, reconnectInterval: 40 }

const LOGIN = { sequenceNumber: 1, action: 'get' }

let fake: FakeSmaart
const connections: SmaartConnection[] = []

beforeEach(async () => {
	fake = await FakeSmaart.start()
})

afterEach(async () => {
	for (const connection of connections.splice(0)) connection.destroy()
	await fake.close()
})

function connect(options: { password?: string; timing?: Partial<ConnectionTiming>; port?: number } = {}) {
	const log = vi.fn<(level: LogLevel, message: string) => void>()
	const statuses: [InstanceStatus, string | null][] = []
	const connection = new SmaartConnection({
		host: '127.0.0.1',
		port: options.port ?? fake.port,
		password: options.password ?? '',
		log,
		timing: { ...TIMING, ...options.timing },
	})
	connection.on('status', (status, message) => statuses.push([status, message]))
	connections.push(connection)
	connection.connect()
	return { connection, log, statuses }
}

/** Connects, and waits for the reply to the login request */
async function connected(options: Parameters<typeof connect>[0] = {}) {
	const created = connect(options)
	await vi.waitFor(() => expect(created.log).toHaveBeenCalledWith('debug', expect.stringContaining('Message received')))
	return created
}

/** A port nothing listens on */
async function closedPort(): Promise<number> {
	const server = await FakeSmaart.start()
	const port = server.port
	await server.close()
	return port
}

describe('connecting', () => {
	it('opens /api/v3/ and asks whether a password is wanted', async () => {
		const { statuses } = await connected()
		expect(fake.paths).toEqual(['/api/v3/'])
		expect(fake.requests[0][0]).toEqual(LOGIN)
		expect(statuses).toEqual([
			[InstanceStatus.Connecting, null],
			[InstanceStatus.Ok, null],
		])
	})

	it('sends the password when the API asks for one', async () => {
		fake.password = 'secret'
		const { statuses } = connect({ password: 'secret' })
		await vi.waitFor(() =>
			expect(fake.requests[0]).toEqual([
				LOGIN,
				{ action: 'set', properties: [{ password: 'secret' }], sequenceNumber: 3 },
			]),
		)
		await sleep(20)
		expect(statuses.at(-1)).toEqual([InstanceStatus.Ok, null])
	})

	it('sends no password when none is asked for', async () => {
		await connected({ password: 'unused' })
		await sleep(20)
		expect(fake.requests[0]).toEqual([LOGIN])
	})

	it('reports a wrong password as an authentication failure', async () => {
		fake.password = 'secret'
		const { statuses, log } = connect({ password: 'wrong' })
		await vi.waitFor(() =>
			expect(statuses.at(-1)).toEqual([InstanceStatus.AuthenticationFailure, 'Incorrect Password']),
		)
		expect(log).toHaveBeenCalledWith('error', 'The submitted password was incorrect')
	})

	it.each(['localhost', 'a', '10.0.0.5', '127.1', '::1', '[::1]', 'smaart_pc', 'smaart-büro'])(
		'takes %s as a host',
		(host) => {
			expect(validHost(host, 26000)).toBe(true)
		},
	)

	it.each(['my host', 'http://10.0.0.5/', '10.0.0.5:26000', '10.0.0.256', 'fe80::1%en0', 'a#b'])(
		'rejects %s as a host, which the WebSocket constructor throws for',
		(host) => {
			expect(() => new WebSocket(apiUrl(host, 26000))).toThrow()
			expect(validHost(host, 26000)).toBe(false)
		},
	)

	it.each(['smaart/api', 'smaart?x', 'user@smaart', 'user:pw@smaart'])(
		'rejects %s as a host, which would connect somewhere else',
		(host) => {
			expect(validHost(host, 26000)).toBe(false)
		},
	)

	it('brackets an IPv6 address in the URL', () => {
		expect(apiUrl('::1', 26000)).toBe('ws://[::1]:26000/api/v3/')
		expect(apiUrl('[::1]', 26000)).toBe('ws://[::1]:26000/api/v3/')
		expect(apiUrl('smaart.local', 26000)).toBe('ws://smaart.local:26000/api/v3/')
	})
})

describe('replies', () => {
	it('reports an error Smaart documents with its description', async () => {
		const { statuses, log } = await connected()
		fake.broadcast({ sequenceNumber: 5, response: { error: 'unknown target' } })
		await vi.waitFor(() => expect(statuses.at(-1)).toEqual([InstanceStatus.UnknownWarning, 'Unknown Target']))
		expect(log).toHaveBeenCalledWith('warn', expect.stringContaining('The target of the request was not recognized'))
	})

	it('reports an error it has no entry for, rather than dropping it', async () => {
		const { statuses, log } = await connected()
		fake.broadcast({ sequenceNumber: 5, response: { error: 'something new' } })
		await vi.waitFor(() => expect(statuses.at(-1)).toEqual([InstanceStatus.UnknownWarning, 'something new']))
		expect(log).toHaveBeenCalledWith('warn', 'Smaart reported an error: something new')
	})

	it('goes back to Ok on the next reply without an error', async () => {
		const { statuses } = await connected()
		fake.broadcast({ sequenceNumber: 5, response: { error: 'timeout' } })
		await vi.waitFor(() => expect(statuses.at(-1)).toEqual([InstanceStatus.UnknownWarning, 'Timeout']))
		fake.broadcast({ sequenceNumber: 6, response: {} })
		await vi.waitFor(() => expect(statuses.at(-1)).toEqual([InstanceStatus.Ok, null]))
	})

	it.each([
		['not JSON', 'not json'],
		['JSON but not an object', '[1, 2]'],
	])('reports a message that is %s as a parsing error', async (_what, message) => {
		const { statuses, log } = await connected()
		fake.broadcast(message)
		await vi.waitFor(() => expect(statuses.at(-1)).toEqual([InstanceStatus.UnknownWarning, 'Parsing Error']))
		expect(log).toHaveBeenCalledWith('warn', expect.stringMatching(/^Parsing Error\. /))
	})

	it('takes a field of an unexpected type as absent, rather than failing the message', async () => {
		const { statuses } = await connected()
		fake.broadcast({ sequenceNumber: 5, response: { error: 'timeout' } })
		await vi.waitFor(() => expect(statuses.at(-1)).toEqual([InstanceStatus.UnknownWarning, 'Timeout']))
		fake.broadcast({ sequenceNumber: 'six', response: 'done' })
		await vi.waitFor(() => expect(statuses.at(-1)).toEqual([InstanceStatus.Ok, null]))
	})

	it('ignores a binary message', async () => {
		const { statuses, log } = await connected()
		fake.sockets[0].send(Buffer.from('{"response":{"error":"timeout"}}'), { binary: true })
		await vi.waitFor(() => expect(log).toHaveBeenCalledWith('debug', 'Ignoring a binary message'))
		expect(statuses.at(-1)).toEqual([InstanceStatus.Ok, null])
	})

	it('reports each status once, though Smaart replies to every keepalive', async () => {
		const { statuses } = await connected({ timing: { keepAliveInterval: 10 } })
		await vi.waitFor(() => expect(fake.requests[0].length).toBeGreaterThan(4))
		expect(statuses).toEqual([
			[InstanceStatus.Connecting, null],
			[InstanceStatus.Ok, null],
		])
	})
})

describe('sending', () => {
	it('numbers requests from 3, keeping 1 for the login', async () => {
		const { connection } = await connected()
		await Promise.all(['H', 'P', 'E'].map(async (key) => connection.send(keypressRequest(key))))
		await vi.waitFor(() => expect(fake.requests[0]).toHaveLength(4))
		expect(fake.requests[0]).toEqual([
			LOGIN,
			{ action: 'issueCommand', properties: [{ keypress: 'H' }], sequenceNumber: 3 },
			{ action: 'issueCommand', properties: [{ keypress: 'P' }], sequenceNumber: 4 },
			{ action: 'issueCommand', properties: [{ keypress: 'E' }], sequenceNumber: 5 },
		])
	})

	it('sends a keepalive once nothing else has been sent for the interval', async () => {
		const { connection } = await connected({ timing: { keepAliveInterval: 50 } })
		await connection.send(keypressRequest('H'))
		await sleep(25)
		await connection.send(keypressRequest('P'))
		await sleep(25)
		// The keypress restarted the wait, so no keepalive yet
		expect(fake.requests[0].map((r) => r.action)).toEqual(['get', 'issueCommand', 'issueCommand'])
		await vi.waitFor(() => expect(fake.requests[0][3]).toEqual({ action: 'get', sequenceNumber: 5 }))
	})

	it('drops a request whose signal aborts before its turn', async () => {
		const { connection } = await connected({ timing: { messageInterval: 150 } })
		const controller = new AbortController()
		const first = connection.send(keypressRequest('H'))
		const second = expect(connection.send(keypressRequest('P'), controller.signal)).rejects.toThrow()
		controller.abort()
		await first
		await second
		await sleep(300)
		expect(fake.requests[0].map((r) => r.properties)).toEqual([undefined, [{ keypress: 'H' }]])
	})

	it('rejects a request while not connected', async () => {
		const { connection } = connect({ port: await closedPort() })
		await expect(connection.send(keypressRequest('H'))).rejects.toThrow('Not connected to Smaart')
	})

	it('gives each connection its own queue, so destroying one leaves what another has queued', async () => {
		const a = await connected({ timing: { messageInterval: 30 } })
		const b = await connected({ timing: { messageInterval: 30 } })
		const keys = ['1', '2', '3', '4', '5']
		const sent = Promise.all(keys.map(async (key) => b.connection.send(keypressRequest(key))))
		a.connection.destroy()
		await sent
		await vi.waitFor(() =>
			expect(fake.requests[1].slice(1).map((r) => r.properties)).toEqual(keys.map((keypress) => [{ keypress }])),
		)
	})
})

describe('reconnecting', () => {
	it('reconnects after Smaart closes the connection', async () => {
		const { statuses, log } = await connected()
		fake.sockets[0].close()
		await vi.waitFor(() => expect(fake.requests[1]).toEqual([LOGIN]))
		await vi.waitFor(() => expect(statuses.at(-1)).toEqual([InstanceStatus.Ok, null]))
		expect(statuses).toContainEqual([InstanceStatus.ConnectionFailure, 'Disconnected from Smaart'])
		expect(log).toHaveBeenCalledWith('info', 'Attempting to reconnect in 0.04 seconds.')
	})

	it('keeps trying while nothing answers', async () => {
		const port = await closedPort()
		const { statuses, log } = connect({ port })
		await vi.waitFor(() =>
			expect(
				log.mock.calls.filter(([, message]) => message.startsWith('Attempting to reconnect')).length,
			).toBeGreaterThan(2),
		)
		expect(log).toHaveBeenCalledWith('error', `Connection error on ws://127.0.0.1:${port}/api/v3/`)
		expect(statuses.at(-1)?.[0]).toBe(InstanceStatus.ConnectionFailure)
	})

	it('connecting again leaves the old socket closed, not reconnecting', async () => {
		// The old socket's close event comes after the new socket is open. Handled as the current socket's, it
		// scheduled a reconnect, which closed the new socket, whose close scheduled another, and so on for good
		const { connection, statuses } = await connected()
		connection.connect()
		await vi.waitFor(() => expect(fake.requests[1]).toEqual([LOGIN]))
		await sleep(TIMING.reconnectInterval * 4)
		expect(fake.sockets).toHaveLength(2)
		expect(fake.openSockets).toHaveLength(1)
		expect(statuses.at(-1)).toEqual([InstanceStatus.Ok, null])
		expect(statuses).not.toContainEqual([InstanceStatus.ConnectionFailure, 'Disconnected from Smaart'])
	})

	it('stops for good once destroyed', async () => {
		const { connection, log } = await connected()
		connection.destroy()
		await vi.waitFor(() => expect(fake.openSockets).toHaveLength(0))
		await sleep(TIMING.reconnectInterval * 4)
		expect(fake.sockets).toHaveLength(1)
		// Its socket's close is not taken for a dropped connection: a reconnect would throw from a timer
		expect(log).not.toHaveBeenCalledWith('info', expect.stringMatching(/^Attempting to reconnect/))
		await expect(connection.send(keypressRequest('H'))).rejects.toThrow()
		expect(() => connection.connect()).toThrow('Connection has been destroyed')
	})
})
