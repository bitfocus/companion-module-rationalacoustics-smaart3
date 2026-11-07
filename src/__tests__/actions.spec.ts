import { describe, expect, it } from 'vitest'
import type { CompanionOptionValues, SomeCompanionActionInputField } from '@companion-module/base'
import { ActionId, GENERATOR_LEVEL_MAX, GENERATOR_LEVEL_MIN } from '../actions.js'
import type { SmaartRequest } from '../requests.js'
import { actionDefinitions, fakeInstance, runAction } from './fixtures.js'

const keypress = (key: string): SmaartRequest => ({ action: 'issueCommand', properties: [{ keypress: key }] })

/**
 * What each action sends. Checked against the module before the TypeScript conversion, by running its actions.js with
 * every choice of every dropdown: the requests matched in all 60 cases.
 */
const REQUESTS: [ActionId, CompanionOptionValues, SmaartRequest][] = [
	[ActionId.ResetAverages, {}, { action: 'set', target: 'activeMeasurements', properties: [{ runningAverage: 0 }] }],
	[ActionId.SelectTabByName, { tabName: 'RTA' }, { action: 'set', target: 'tabs', properties: [{ activeTab: 'RTA' }] }],
	[
		ActionId.StartAllMeasurements,
		{ tabName: 'RTA' },
		{ action: 'set', target: { tabName: 'RTA', measurementName: 'allMeasurements' }, properties: [{ active: true }] },
	],
	[ActionId.StartGenerator, {}, { action: 'set', target: 'signalGenerator', properties: [{ active: true }] }],
	[ActionId.StopGenerator, {}, { action: 'set', target: 'signalGenerator', properties: [{ active: false }] }],
	[
		ActionId.SetGeneratorLevel,
		{ level: -12.5 },
		{ action: 'set', target: 'signalGenerator', properties: [{ gain: -12.5 }] },
	],
	[
		ActionId.StartTrackingAll,
		{},
		{
			action: 'set',
			target: { measurementName: 'allTransferFunctionMeasurements' },
			properties: [{ trackingDelay: true }],
		},
	],
	[
		ActionId.StopTrackingAll,
		{},
		{
			action: 'set',
			target: { measurementName: 'allTransferFunctionMeasurements' },
			properties: [{ trackingDelay: false }],
		},
	],
	[ActionId.ZoomX, { selectedDirection: '+' }, keypress('option + command+')],
	[ActionId.ZoomX, { selectedDirection: '-' }, keypress('option + command-')],
	[ActionId.ZoomY, { selectedDirection: '+' }, keypress('+')],
	[ActionId.ZoomY, { selectedDirection: '-' }, keypress('-')],
	[ActionId.ZoomXY, { selectedDirection: '+' }, keypress('command+')],
	[ActionId.ZoomXY, { selectedDirection: '-' }, keypress('command-')],
	[ActionId.SetZoomPreset, { zoomPreset: '5' }, keypress('option + 5')],
	[ActionId.SetZoomPreset, { zoomPreset: '2' }, keypress('option + 2')],
	[ActionId.ArrowKeys, { selectedDirection: 'up' }, keypress('cursor up')],
	[ActionId.ArrowKeys, { selectedDirection: 'right' }, keypress('cursor right')],
	[ActionId.CycleZOrder, { selectedDirection: 'forward' }, keypress('Z')],
	[ActionId.CycleZOrder, { selectedDirection: 'backward' }, keypress('shift + Z')],
	[ActionId.HideTrace, {}, keypress('H')],
	[ActionId.HideAllTraces, {}, keypress('shift + command + H')],
	[ActionId.TogglePeakHold, {}, keypress('P')],
	[ActionId.ToggleInputMeters, {}, keypress('shift + E')],
	[ActionId.ToggleInputMeterOrientation, {}, keypress('shift + option + E')],
	[ActionId.ToggleSPLHistory, {}, keypress('option + H')],
	[ActionId.ToggleMeters, {}, keypress('E')],
	[ActionId.SelectViewPreset, { viewPreset: 'T' }, keypress('T')],
	[ActionId.SelectViewPreset, { viewPreset: '0' }, keypress('0')],
	[ActionId.MoveFrontTrace, { selectedDirection: 'down' }, keypress('command + cursor down')],
	[ActionId.ClearTraceOffset, {}, keypress('Y')],
	[ActionId.ClearAllTraceOffset, {}, keypress('command + Y')],
	[ActionId.ToggleBar, { selectedBar: 'U' }, keypress('U')],
	[ActionId.LockCursorToPeak, {}, keypress('command + P')],
	[ActionId.ClearLockedCursor, {}, keypress('command + X')],
	[ActionId.MoveLockedCursor, { selectedDirection: 'left' }, keypress('command + cursor left')],
	[ActionId.CyclePlot, {}, keypress('M')],
	[ActionId.CaptureTrace, { traceName: 'Main L' }, { action: 'capture', target: { measurementName: 'Main L' } }],
	[
		ActionId.RenameTrace,
		{ traceName: 'Main L', tracePath: '/traces/a.trc' },
		{ action: 'set', target: { traceFilePath: '/traces/a.trc' }, properties: [{ name: 'Main L' }] },
	],
]

/** Every option of every action, with the id of the action it belongs to */
function allFields(): [string, SomeCompanionActionInputField][] {
	return Object.entries(actionDefinitions(fakeInstance())).flatMap(([actionId, def]) =>
		def ? def.options.map((field): [string, SomeCompanionActionInputField] => [actionId, field]) : [],
	)
}

describe('requests', () => {
	it.each(REQUESTS)('%s with %j sends %j', async (actionId, options, request) => {
		const fake = fakeInstance()
		await runAction(actionDefinitions(fake), actionId, options)
		expect(fake.send.mock.calls).toEqual([[request, expect.any(AbortSignal)]])
	})

	it('covers every action', () => {
		expect(new Set(REQUESTS.map(([actionId]) => actionId))).toEqual(new Set(Object.values(ActionId)))
	})

	it("passes the action's signal on, so a request the user no longer wants is dropped", async () => {
		const fake = fakeInstance()
		const { signal } = new AbortController()
		await runAction(actionDefinitions(fake), ActionId.HideTrace, {}, signal)
		expect(fake.send.mock.calls[0][1]).toBe(signal)
	})
})

describe('options', () => {
	it('gives every dropdown a default that is one of its choices', () => {
		for (const [actionId, field] of allFields()) {
			if (field.type !== 'dropdown') continue
			expect(
				field.choices.map((c) => c.id),
				`${actionId}.${field.id}`,
			).toContain(field.default)
		}
	})

	it('says what an expression for a dropdown has to return, as its ids are not what it shows', () => {
		const defs = actionDefinitions(fakeInstance())
		const field = (defs[ActionId.ToggleBar] || undefined)?.options[0]
		expect(field?.expressionDescription).toBe(
			"The expression must return one of: 'O' (Control), 'U' (Command), 'B' (Data)",
		)
		for (const [actionId, dropdown] of allFields().filter(([, f]) => f.type === 'dropdown')) {
			expect(dropdown.expressionDescription, `${actionId}.${dropdown.id}`).toMatch(
				/^The expression must return one of: /,
			)
		}
	})

	it('has every text field parse variables and need a value', () => {
		const textFields = allFields().filter(([, field]) => field.type === 'textinput')
		expect(textFields).toHaveLength(5)
		for (const [actionId, field] of textFields) {
			expect(field, `${actionId}.${field.id}`).toMatchObject({ useVariables: true, minLength: 1 })
		}
	})
})

describe('values Companion passes on unchecked', () => {
	it('rejects a dropdown value that is not one of the choices, sending nothing', async () => {
		const fake = fakeInstance()
		await expect(runAction(actionDefinitions(fake), ActionId.ZoomX, { selectedDirection: 'sideways' })).rejects.toThrow(
			'Direction sideways is not valid',
		)
		expect(fake.send).not.toHaveBeenCalled()
	})

	it('takes a number from an expression as the choice it spells', async () => {
		const fake = fakeInstance()
		await runAction(actionDefinitions(fake), ActionId.SetZoomPreset, { zoomPreset: 3 })
		expect(fake.send.mock.calls[0][0]).toEqual(keypress('option + 3'))
	})

	it('rejects an empty name, sending nothing', async () => {
		const fake = fakeInstance()
		const defs = actionDefinitions(fake)
		await expect(runAction(defs, ActionId.SelectTabByName, { tabName: '' })).rejects.toThrow('Tab Name is empty')
		await expect(runAction(defs, ActionId.CaptureTrace, {})).rejects.toThrow('Trace Name is empty')
		await expect(runAction(defs, ActionId.RenameTrace, { traceName: 'a', tracePath: '' })).rejects.toThrow(
			'Trace File Path is empty',
		)
		expect(fake.send).not.toHaveBeenCalled()
	})

	it('takes a number from an expression as the text it spells', async () => {
		const fake = fakeInstance()
		await runAction(actionDefinitions(fake), ActionId.SelectTabByName, { tabName: 12 })
		expect(fake.send.mock.calls[0][0]).toEqual({ action: 'set', target: 'tabs', properties: [{ activeTab: '12' }] })
	})

	it('clamps the generator level to its range', async () => {
		const fake = fakeInstance()
		const defs = actionDefinitions(fake)
		await runAction(defs, ActionId.SetGeneratorLevel, { level: -300 })
		await runAction(defs, ActionId.SetGeneratorLevel, { level: 6 })
		expect(fake.send.mock.calls.map(([request]) => request.properties)).toEqual([
			[{ gain: GENERATOR_LEVEL_MIN }],
			[{ gain: GENERATOR_LEVEL_MAX }],
		])
	})

	it('rejects a generator level that is not a number, sending nothing', async () => {
		const fake = fakeInstance()
		await expect(runAction(actionDefinitions(fake), ActionId.SetGeneratorLevel, { level: '-6' })).rejects.toThrow(
			'Level -6 is not valid',
		)
		expect(fake.send).not.toHaveBeenCalled()
	})
})
