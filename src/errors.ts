import { InstanceStatus, type LogLevel } from '@companion-module/base'

export interface SmaartError {
	description: string
	status: InstanceStatus
	/** The message shown with the connection's status */
	statusDescription: string
	logLevel: LogLevel
}

/**
 * The errors the API reports, by the id it reports them with. The module has always matched 'incorect password' as
 * well as 'incorrect password', and 'unkown property' but not 'unknown property'. Which spellings Smaart sends is not
 * known here, so each is listed both ways.
 */
export const SMAART_ERRORS: Readonly<Record<string, SmaartError | undefined>> = {
	'parse error': {
		description: 'An error occurred while parsing the JSON request',
		status: InstanceStatus.UnknownWarning,
		statusDescription: 'Parsing Error',
		logLevel: 'warn',
	},
	timeout: {
		description:
			'The timeout elapsed while an asynchronous operation was being carried out (making a window or tab active, etc)',
		status: InstanceStatus.UnknownWarning,
		statusDescription: 'Timeout',
		logLevel: 'warn',
	},
	'unknown target': {
		description:
			'The target of the request was not recognized - name misspelled, measurement was specified that was not in the active tab/window. etc.',
		status: InstanceStatus.UnknownWarning,
		statusDescription: 'Unknown Target',
		logLevel: 'warn',
	},
	'unknown action': {
		description: 'The action was not recognized by the target',
		status: InstanceStatus.UnknownWarning,
		statusDescription: 'Unknown Action',
		logLevel: 'warn',
	},
	'unknown property': {
		description: 'The property does not apply to the target',
		status: InstanceStatus.UnknownWarning,
		statusDescription: 'Unknown Property',
		logLevel: 'warn',
	},
	'unkown property': {
		description: 'The property does not apply to the target',
		status: InstanceStatus.UnknownWarning,
		statusDescription: 'Unknown Property',
		logLevel: 'warn',
	},
	'unknown value': {
		description: 'The value does not apply to the property',
		status: InstanceStatus.UnknownWarning,
		statusDescription: 'Unknown Value',
		logLevel: 'warn',
	},
	'read only': {
		description: 'An attempt was made to ‘set’ a property that is read-only',
		status: InstanceStatus.UnknownWarning,
		statusDescription: 'Attempt to set read only property',
		logLevel: 'warn',
	},
	'not implemented': {
		description: 'A hole in the implementation, or an unreasonable request has been made',
		status: InstanceStatus.UnknownWarning,
		statusDescription: 'Not Implemented',
		logLevel: 'warn',
	},
	'signal generator required': {
		description:
			'An attempt was made to start a measurement that requires the signal generator to be active - this will not be returned when attempting to start all measurements of a tab',
		status: InstanceStatus.UnknownWarning,
		statusDescription: 'Sig Gen Required',
		logLevel: 'warn',
	},
	'measurement not active': {
		description:
			'An attempt to find the delay of a measurement was made while the measurement was not active and the automaticallyStart property was not set',
		status: InstanceStatus.UnknownWarning,
		statusDescription: 'Measurement not active',
		logLevel: 'warn',
	},
	'authentication required': {
		description: 'The API requires a password',
		status: InstanceStatus.AuthenticationFailure,
		statusDescription: 'Authentication Required',
		logLevel: 'warn',
	},
	'incorrect password': {
		description: 'The submitted password was incorrect',
		status: InstanceStatus.AuthenticationFailure,
		statusDescription: 'Incorrect Password',
		logLevel: 'error',
	},
	'incorect password': {
		description: 'The submitted password was incorrect',
		status: InstanceStatus.AuthenticationFailure,
		statusDescription: 'Incorrect Password',
		logLevel: 'error',
	},
	'internal error': {
		description: 'Internal error: Theoretical impossibility',
		status: InstanceStatus.UnknownError,
		statusDescription: 'Internal Error',
		logLevel: 'error',
	},
}

/** An error id not in {@link SMAART_ERRORS}, which used to be dropped without a word */
export function unknownSmaartError(id: string): SmaartError {
	return {
		description: `Smaart reported an error: ${id}`,
		status: InstanceStatus.UnknownWarning,
		statusDescription: id,
		logLevel: 'warn',
	}
}
