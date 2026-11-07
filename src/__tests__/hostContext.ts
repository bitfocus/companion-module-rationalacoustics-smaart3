import { vi } from 'vitest'

/** What InstanceBase needs from the host, with everything it forwards to Companion mocked */
export class HostContext {
	readonly id = 'test-instance'
	readonly _isInstanceContext = true
	readonly label = 'test'
	readonly upgradeScripts = []
	readonly saveConfig = vi.fn()
	readonly updateStatus = vi.fn()
	readonly oscSend = vi.fn()
	readonly recordAction = vi.fn()
	readonly setActionDefinitions = vi.fn()
	readonly subscribeActions = vi.fn()
	readonly unsubscribeActions = vi.fn()
	readonly setFeedbackDefinitions = vi.fn()
	readonly unsubscribeFeedbacks = vi.fn()
	readonly checkFeedbacks = vi.fn()
	readonly checkAllFeedbacks = vi.fn()
	readonly checkFeedbacksById = vi.fn()
	readonly setPresetDefinitions = vi.fn()
	readonly setCompositeElementDefinitions = vi.fn()
	readonly setVariableDefinitions = vi.fn()
	readonly setVariableValues = vi.fn()
	readonly getVariableValue = vi.fn()
	readonly sharedUdpSocketJoin = vi.fn()
	readonly sharedUdpSocketLeave = vi.fn()
	readonly sharedUdpSocketSend = vi.fn()
}

export function createContext(): HostContext {
	return new HostContext()
}
