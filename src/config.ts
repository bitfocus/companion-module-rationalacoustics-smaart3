import type { SomeCompanionConfigField } from '@companion-module/base'

export const DEFAULT_HOST = 'localhost'
export const DEFAULT_PORT = 26000

export type ModuleConfig = {
	host: string
	/** A textinput, saved as a string, until UpgradeScripts[0] */
	port: number
}

/**
 * Kept out of the config, which Companion reports in full to the web UI. The password was in the config until
 * UpgradeScripts[0] moved it here.
 */
export type ModuleSecrets = {
	/** Empty if the API has no password */
	password: string
}

export function GetConfigFields(): SomeCompanionConfigField[] {
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
			default: DEFAULT_HOST,
			minLength: 1,
		},
		{
			type: 'number',
			id: 'port',
			label: 'Target Port',
			width: 6,
			min: 1,
			max: 65535,
			asInteger: true,
			default: DEFAULT_PORT,
		},
		{
			type: 'secret-text',
			id: 'password',
			label: 'Password',
			width: 6,
			tooltip: 'If authentication is not used leave password blank',
			minLength: 0,
			default: '',
		},
	]
}

/** The port, or undefined if it is not one TCP can use. A saved config isn't checked against its field's min and max */
export function validPort(port: unknown): number | undefined {
	return typeof port === 'number' && Number.isInteger(port) && port >= 1 && port <= 65535 ? port : undefined
}

/**
 * The password to log in with. Secrets saved before the password was one may not have it, and a saved secret isn't
 * checked against its field, so anything but a string is taken as no password.
 */
export function loginPassword(secrets: ModuleSecrets | undefined): string {
	const password: unknown = secrets?.password
	return typeof password === 'string' ? password : ''
}
