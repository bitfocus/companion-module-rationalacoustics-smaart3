import { setTimeout as sleep } from 'node:timers/promises'
import { InstanceStatus } from '@companion-module/base'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SmaartInstance from '../main.js'
import type { ModuleConfig, ModuleSecrets } from '../config.js'
import type { ConnectionTiming } from '../connection.js'
import { keypressRequest } from '../requests.js'
import { FakeSmaart } from './fakeSmaart.js'
import { createContext } from './hostContext.js'

const TIMING: ConnectionTiming = { messageInterval: 1, keepAliveInterval: 60_000, reconnectInterval: 40 }

const LOGIN = { sequenceNumber: 1, action: 'get' }

let fake: FakeSmaart
const instances: SmaartInstance[] = []

beforeEach(async () => {
	fake = await FakeSmaart.start()
})

afterEach(async () => {
	for (const instance of instances.splice(0)) await instance.destroy()
	await fake.close()
})

function createInstance() {
	const context = createContext()
	const instance = new SmaartInstance(context)
	instance.timing = TIMING
	const log = vi.spyOn(instance, 'log').mockImplementation(() => {})
	instances.push(instance)
	return { instance, context, log }
}

function config(overrides: Record<string, unknown> = {}): ModuleConfig {
	return { host: '127.0.0.1', port: fake.port, ...overrides }
}

/** Waits for the reply to the login request */
async function started(secrets: ModuleSecrets | undefined = undefined) {
	const created = createInstance()
	await created.instance.init(config(), false, secrets)
	await vi.waitFor(() => expect(created.log).toHaveBeenCalledWith('debug', expect.stringContaining('Message received')))
	return created
}

describe('connecting', () => {
	it('logs in with the password from the secrets', async () => {
		fake.password = 'secret'
		const { context } = await started({ password: 'secret' })
		await vi.waitFor(() => expect(fake.requests[0]).toHaveLength(2))
		expect(fake.requests[0][1]).toMatchObject({ action: 'set', properties: [{ password: 'secret' }] })
		expect(context.updateStatus).toHaveBeenLastCalledWith(InstanceStatus.Ok, null)
	})

	it('connects without a password when the secrets have none', async () => {
		const { context } = await started(undefined)
		expect(fake.requests[0]).toEqual([LOGIN])
		expect(context.updateStatus).toHaveBeenLastCalledWith(InstanceStatus.Ok, null)
	})

	it.each([
		['no host', { host: '  ' }, 'No host'],
		['a port saved as text', { port: '26000' }, 'Invalid port 26000'],
		['a port TCP cannot use', { port: 70000 }, 'Invalid port 70000'],
		// init used to throw from the WebSocket constructor for this
		['a host the URL parser rejects', { host: 'my host' }, 'Invalid host my host'],
		// This one connected to smaart, on port 80
		['a host that parses as a path', { host: 'smaart/api' }, 'Invalid host smaart/api'],
	])('reports a config with %s as bad, and does not connect', async (_what, overrides, message) => {
		const { instance, context } = createInstance()
		await instance.init(config(overrides), false, undefined)
		expect(context.updateStatus).toHaveBeenLastCalledWith(InstanceStatus.BadConfig, message)
		await expect(instance.send(keypressRequest('H'))).rejects.toThrow('Not connected to Smaart')
		await sleep(50)
		expect(fake.sockets).toHaveLength(0)
	})
})

describe('changing the config', () => {
	it('leaves only the new connection, with no reconnect from the old one', async () => {
		// Before the TypeScript conversion, the old socket's late close event was taken for the new socket's. It set
		// the status to Disconnected and scheduled a reconnect, which closed the new socket, whose close scheduled
		// another, every 10 seconds from the first config change on
		const { instance, context, log } = await started()
		context.updateStatus.mockClear()
		await instance.configUpdated(config(), undefined)
		await vi.waitFor(() => expect(fake.requests[1]).toEqual([LOGIN]))
		await sleep(TIMING.reconnectInterval * 4)
		expect(fake.sockets).toHaveLength(2)
		expect(fake.openSockets).toHaveLength(1)
		expect(context.updateStatus.mock.calls).toEqual([
			[InstanceStatus.Connecting, null],
			[InstanceStatus.Ok, null],
		])
		// The old connection is destroyed, so its status no longer reaches the instance. Its socket's close must not
		// schedule a reconnect either: that would throw from a timer, which ends the module's process
		expect(log).not.toHaveBeenCalledWith('info', expect.stringMatching(/^Attempting to reconnect/))
	})

	it('connects to the new port', async () => {
		const { instance } = await started()
		const other = await FakeSmaart.start()
		try {
			await instance.configUpdated(config({ port: other.port }), undefined)
			await vi.waitFor(() => expect(other.requests[0]).toEqual([LOGIN]))
			await vi.waitFor(() => expect(fake.openSockets).toHaveLength(0))
		} finally {
			await instance.destroy()
			await other.close()
		}
	})
})

describe('sending', () => {
	it('sends requests on the connection', async () => {
		const { instance } = await started()
		await instance.send(keypressRequest('H'))
		await vi.waitFor(() =>
			expect(fake.requests[0][1]).toEqual({
				action: 'issueCommand',
				properties: [{ keypress: 'H' }],
				sequenceNumber: 3,
			}),
		)
	})
})

it('closes the connection when destroyed, and does not reconnect', async () => {
	const { instance } = await started()
	await instance.destroy()
	await vi.waitFor(() => expect(fake.openSockets).toHaveLength(0))
	await sleep(TIMING.reconnectInterval * 4)
	expect(fake.sockets).toHaveLength(1)
	await expect(instance.send(keypressRequest('H'))).rejects.toThrow('Not connected to Smaart')
})
