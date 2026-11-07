import { describe, expect, it } from 'vitest'
import type { CompanionStaticUpgradeProps, CompanionUpgradeContext } from '@companion-module/base'
import { UpgradeScripts } from '../upgrades.js'
import { DEFAULT_PORT, GetConfigFields, type ModuleConfig, type ModuleSecrets } from '../config.js'

/**
 * Upgrade scripts are order-sensitive: a stored upgrade index records how far a configuration has been migrated, so
 * scripts may only ever be appended. Pin the indexes rather than taking the last entry, so appending a script can't
 * silently retarget this suite.
 */
const API2_SCRIPT_INDEX = 0
const EXPECTED_SCRIPT_COUNT = 1

/** A config as the module before API 2.x saved it, with the defaults it gave a new connection */
const oldConfig = (overrides: Record<string, unknown> = {}) =>
	({ host: 'localhost', port: '26000', password: '', ...overrides }) as unknown as ModuleConfig

function run(index: number, savedConfig: ModuleConfig | null, savedSecrets: ModuleSecrets | null = null) {
	return UpgradeScripts[index]({} as CompanionUpgradeContext<ModuleConfig>, {
		config: savedConfig,
		secrets: savedSecrets,
		actions: [],
		feedbacks: [],
	} satisfies CompanionStaticUpgradeProps<ModuleConfig, ModuleSecrets>)
}

it('the scripts sit at the indexes this suite targets', () => {
	// Appending a script is fine — bump EXPECTED_SCRIPT_COUNT. Never insert, reorder or remove one.
	expect(UpgradeScripts).toHaveLength(EXPECTED_SCRIPT_COUNT)
})

describe('API 2.x upgrade script', () => {
	it('makes the port a number and moves the password to the secrets', () => {
		const result = run(API2_SCRIPT_INDEX, oldConfig({ host: '10.0.0.5', port: '26001', password: 'abc' }))
		expect(result.updatedConfig).toEqual({ host: '10.0.0.5', port: 26001 })
		expect(result.updatedSecrets).toEqual({ password: 'abc' })
		expect(result.updatedActions).toEqual([])
	})

	it("converts the old field's default", () => {
		expect(run(API2_SCRIPT_INDEX, oldConfig()).updatedConfig).toEqual({ host: 'localhost', port: DEFAULT_PORT })
	})

	it('leaves a port that is not a number for the module to reject', () => {
		expect(run(API2_SCRIPT_INDEX, oldConfig({ port: 'smaart' })).updatedConfig).toEqual({
			host: 'localhost',
			port: 'smaart',
		})
		expect(run(API2_SCRIPT_INDEX, oldConfig({ port: '' })).updatedConfig).toMatchObject({ port: '' })
	})

	it('moves an empty password as empty, and a missing one as empty too', () => {
		expect(run(API2_SCRIPT_INDEX, oldConfig({ password: '' })).updatedSecrets).toEqual({ password: '' })
		expect(run(API2_SCRIPT_INDEX, oldConfig({ password: undefined })).updatedSecrets).toEqual({ password: '' })
	})

	it('keeps a password already in the secrets, still taking it out of the config', () => {
		const result = run(API2_SCRIPT_INDEX, oldConfig({ password: 'old' }), { password: 'new' })
		expect(result.updatedConfig).not.toHaveProperty('password')
		expect(result.updatedSecrets).toBeNull()
	})

	it('changes nothing for a config already upgraded, or no config', () => {
		const upgraded = { host: 'localhost', port: DEFAULT_PORT }
		expect(run(API2_SCRIPT_INDEX, upgraded)).toMatchObject({ updatedConfig: null, updatedSecrets: null })
		expect(run(API2_SCRIPT_INDEX, null)).toMatchObject({ updatedConfig: null, updatedSecrets: null })
	})

	it('moves them to fields of those types now', () => {
		const fields = GetConfigFields()
		expect(fields.find((field) => field.id === 'port')?.type).toBe('number')
		expect(fields.find((field) => field.id === 'password')?.type).toBe('secret-text')
	})
})
