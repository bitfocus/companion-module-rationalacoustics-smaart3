import type {
	CompanionStaticUpgradeProps,
	CompanionStaticUpgradeResult,
	CompanionStaticUpgradeScript,
	CompanionUpgradeContext,
} from '@companion-module/base'
import type { ModuleConfig, ModuleSecrets } from './config.js'

/** A config as saved before UpgradeScripts[0]: the port a string, and the password still in it */
type ConfigBeforeApi2 = Omit<ModuleConfig, 'port'> & { port?: unknown; password?: unknown }

/** The port as a number, where a textinput saved it as a string. Anything else is left for validPort to reject */
function numericPort(port: unknown): unknown {
	if (typeof port !== 'string' || !/^\d+$/.test(port.trim())) return port
	return Number(port.trim())
}

export const UpgradeScripts: CompanionStaticUpgradeScript<ModuleConfig, ModuleSecrets>[] = [
	/*
	 * Place your upgrade scripts here
	 * Remember that once it has been added it cannot be removed!
	 */

	// 0: API 2.x — the port became a number field, and the password moved from the config to the secrets, which
	// Companion does not report to the web UI. No action options changed type, so none need converting.
	function api2(
		_context: CompanionUpgradeContext<ModuleConfig>,
		props: CompanionStaticUpgradeProps<ModuleConfig, ModuleSecrets>,
	): CompanionStaticUpgradeResult<ModuleConfig, ModuleSecrets> {
		const result: CompanionStaticUpgradeResult<ModuleConfig, ModuleSecrets> = {
			updatedConfig: null,
			updatedSecrets: null,
			updatedActions: [],
			updatedFeedbacks: [],
		}
		if (props.config === null) return result
		const { password, ...config } = props.config as ConfigBeforeApi2
		const port = numericPort(config.port)
		if (port === config.port && !('password' in props.config)) return result
		// Cast as validPort checks the port when connecting: a saved config isn't checked against its fields
		result.updatedConfig = { ...config, port } as ModuleConfig
		// A password already in the secrets can only have been entered since, so it is the one to keep
		if ('password' in props.config && typeof props.secrets?.password !== 'string') {
			result.updatedSecrets = { ...props.secrets, password: typeof password === 'string' ? password : '' }
		}
		return result
	},
]
