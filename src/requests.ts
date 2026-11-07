import type { JsonValue } from '@companion-module/base'

/** A request to the Smaart API V3, before it is given a sequence number */
export type SmaartRequest = {
	/** Given by the connection when left out. {@link LOGIN_SEQUENCE_NUMBER} is kept for the login request */
	sequenceNumber?: number
	action: 'get' | 'set' | 'capture' | 'issueCommand'
	target?: string | Record<string, string>
	properties?: Record<string, JsonValue>[]
}

/** The reply to the request sent on connecting says whether the API wants a password */
export const LOGIN_SEQUENCE_NUMBER = 1

/** Sent on connecting. The reply says whether a password is wanted */
export function loginRequest(): SmaartRequest {
	return { sequenceNumber: LOGIN_SEQUENCE_NUMBER, action: 'get' }
}

/** Sent when nothing else has been for a while, so Smaart doesn't time the connection out */
export function keepAliveRequest(): SmaartRequest {
	return { action: 'get' }
}

export function passwordRequest(password: string): SmaartRequest {
	return { action: 'set', properties: [{ password }] }
}

export function resetAveragesRequest(): SmaartRequest {
	return { action: 'set', target: 'activeMeasurements', properties: [{ runningAverage: 0 }] }
}

export function selectTabRequest(tabName: string): SmaartRequest {
	return { action: 'set', target: 'tabs', properties: [{ activeTab: tabName }] }
}

export function startAllMeasurementsRequest(tabName: string): SmaartRequest {
	return {
		action: 'set',
		target: { tabName, measurementName: 'allMeasurements' },
		properties: [{ active: true }],
	}
}

export function generatorStateRequest(active: boolean): SmaartRequest {
	return { action: 'set', target: 'signalGenerator', properties: [{ active }] }
}

/** @param gain in dB FS */
export function generatorLevelRequest(gain: number): SmaartRequest {
	return { action: 'set', target: 'signalGenerator', properties: [{ gain }] }
}

/** Starts or stops delay tracking for every transfer function measurement in the current tab */
export function trackingStateRequest(trackingDelay: boolean): SmaartRequest {
	return {
		action: 'set',
		target: { measurementName: 'allTransferFunctionMeasurements' },
		properties: [{ trackingDelay }],
	}
}

export function captureTraceRequest(traceName: string): SmaartRequest {
	return { action: 'capture', target: { measurementName: traceName } }
}

/** @param tracePath the full path and file name of the trace to rename */
export function renameTraceRequest(traceName: string, tracePath: string): SmaartRequest {
	return { action: 'set', target: { traceFilePath: tracePath }, properties: [{ name: traceName }] }
}

/** Has Smaart act as if a key had been pressed, eg 'shift + Z' */
export function keypressRequest(keypress: string): SmaartRequest {
	return { action: 'issueCommand', properties: [{ keypress }] }
}
