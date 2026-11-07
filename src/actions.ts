import type { CompanionActionDefinition, CompanionActionDefinitions, DropdownChoice } from '@companion-module/base'
import type SmaartInstance from './main.js'
import {
	ARROW_DIRECTIONS,
	BARS,
	LOCKED_CURSOR_DIRECTIONS,
	TRACE_OFFSET_DIRECTIONS,
	VIEW_PRESETS,
	Z_ORDER_DIRECTIONS,
	ZOOM_DIRECTIONS,
	ZOOM_PRESETS,
	type ArrowDirection,
	type Bar,
	type LockedCursorDirection,
	type TraceOffsetDirection,
	type ViewPreset,
	type ZOrderDirection,
	type ZoomDirection,
	type ZoomPreset,
} from './choices.js'
import {
	captureTraceRequest,
	generatorLevelRequest,
	generatorStateRequest,
	keypressRequest,
	renameTraceRequest,
	resetAveragesRequest,
	selectTabRequest,
	startAllMeasurementsRequest,
	trackingStateRequest,
	type SmaartRequest,
} from './requests.js'
import { choicesExpressionDescription, choiceValue, numberValue, textValue } from './utils.js'

/**
 * Action ids. The values are the ids saved against every button using the action, so they must never change. They
 * predate this enum, which is why they are camelCase.
 */
export enum ActionId {
	ResetAverages = 'resetAvg',
	SelectTabByName = 'selectTabByName',
	StartAllMeasurements = 'startAllMeasurements',
	StartGenerator = 'startGenerator',
	StopGenerator = 'stopGenerator',
	SetGeneratorLevel = 'setGeneratorLevel',
	StartTrackingAll = 'startTrackingAll',
	StopTrackingAll = 'stopTrackingAll',
	ZoomX = 'zoomX',
	ZoomY = 'zoomY',
	ZoomXY = 'zoomXY',
	SetZoomPreset = 'setZoomPreset',
	ArrowKeys = 'arrowKeys',
	CycleZOrder = 'cycleZOrder',
	HideTrace = 'hideTrace',
	HideAllTraces = 'hideAllTraces',
	TogglePeakHold = 'togglePeakHold',
	ToggleInputMeters = 'toggleInputMeters',
	ToggleInputMeterOrientation = 'toggleInputMeterOrientation',
	ToggleSPLHistory = 'toggleSPLHistory',
	ToggleMeters = 'toggleMeters',
	SelectViewPreset = 'selectViewPreset',
	MoveFrontTrace = 'moveFrontTrace',
	ClearTraceOffset = 'clearTraceOffset',
	ClearAllTraceOffset = 'clearAllTraceOffset',
	ToggleBar = 'toggleBar',
	LockCursorToPeak = 'lockCursorToPeak',
	ClearLockedCursor = 'clearLockedCursor',
	MoveLockedCursor = 'moveLockedCursor',
	CyclePlot = 'cyclePlot',
	CaptureTrace = 'captureTrace',
	RenameTrace = 'renameTrace',
}

type NoOptions = { options: Record<string, never> }

export type ActionSchema = {
	[ActionId.ResetAverages]: NoOptions
	[ActionId.SelectTabByName]: { options: { tabName: string } }
	[ActionId.StartAllMeasurements]: { options: { tabName: string } }
	[ActionId.StartGenerator]: NoOptions
	[ActionId.StopGenerator]: NoOptions
	[ActionId.SetGeneratorLevel]: { options: { level: number } }
	[ActionId.StartTrackingAll]: NoOptions
	[ActionId.StopTrackingAll]: NoOptions
	[ActionId.ZoomX]: { options: { selectedDirection: ZoomDirection } }
	[ActionId.ZoomY]: { options: { selectedDirection: ZoomDirection } }
	[ActionId.ZoomXY]: { options: { selectedDirection: ZoomDirection } }
	[ActionId.SetZoomPreset]: { options: { zoomPreset: ZoomPreset } }
	[ActionId.ArrowKeys]: { options: { selectedDirection: ArrowDirection } }
	[ActionId.CycleZOrder]: { options: { selectedDirection: ZOrderDirection } }
	[ActionId.HideTrace]: NoOptions
	[ActionId.HideAllTraces]: NoOptions
	[ActionId.TogglePeakHold]: NoOptions
	[ActionId.ToggleInputMeters]: NoOptions
	[ActionId.ToggleInputMeterOrientation]: NoOptions
	[ActionId.ToggleSPLHistory]: NoOptions
	[ActionId.ToggleMeters]: NoOptions
	[ActionId.SelectViewPreset]: { options: { viewPreset: ViewPreset } }
	[ActionId.MoveFrontTrace]: { options: { selectedDirection: TraceOffsetDirection } }
	[ActionId.ClearTraceOffset]: NoOptions
	[ActionId.ClearAllTraceOffset]: NoOptions
	[ActionId.ToggleBar]: { options: { selectedBar: Bar } }
	[ActionId.LockCursorToPeak]: NoOptions
	[ActionId.ClearLockedCursor]: NoOptions
	[ActionId.MoveLockedCursor]: { options: { selectedDirection: LockedCursorDirection } }
	[ActionId.CyclePlot]: NoOptions
	[ActionId.CaptureTrace]: { options: { traceName: string } }
	[ActionId.RenameTrace]: { options: { traceName: string; tracePath: string } }
}

/** The signal generator's level range, in dB FS */
export const GENERATOR_LEVEL_MIN = -200
export const GENERATOR_LEVEL_MAX = 0

const Z_ORDER_KEYPRESSES: Record<ZOrderDirection, string> = {
	forward: 'Z',
	backward: 'shift + Z',
}

/** An action with no options, sending one request */
function requestAction(
	self: SmaartInstance,
	name: string,
	request: () => SmaartRequest,
): CompanionActionDefinition<NoOptions> {
	return {
		name,
		options: [],
		callback: async (_action, { signal }) => self.send(request(), signal),
	}
}

/** An action with no options, pressing one key in Smaart */
function keypressAction(self: SmaartInstance, name: string, keypress: string): CompanionActionDefinition<NoOptions> {
	return requestAction(self, name, () => keypressRequest(keypress))
}

interface ChoiceKeypressSpec<TKey extends string, TId extends string> {
	name: string
	description?: string
	/** The option's id, saved against every button using the action */
	id: TKey
	label: string
	tooltip: string
	choices: readonly DropdownChoice<TId>[]
	default: TId
	/** The key pressed in Smaart for the choice made */
	keypress: (choice: TId) => string
}

/** An action with one dropdown, pressing the key for the choice made */
function choiceKeypressAction<TKey extends string, TId extends string>(
	self: SmaartInstance,
	spec: ChoiceKeypressSpec<TKey, TId>,
): CompanionActionDefinition<{ options: Record<TKey, TId> }> {
	return {
		name: spec.name,
		...(spec.description === undefined ? {} : { description: spec.description }),
		options: [
			{
				type: 'dropdown',
				// Base keys options by Extract<TKey, string>. That is TKey, but TypeScript can't tell while TKey is generic
				id: spec.id as Extract<TKey, string>,
				label: spec.label,
				tooltip: spec.tooltip,
				choices: [...spec.choices],
				default: spec.default,
				expressionDescription: choicesExpressionDescription(spec.choices),
			},
		],
		callback: async ({ options }, { signal }) => {
			const choice = choiceValue(spec.choices, options[spec.id], spec.label)
			await self.send(keypressRequest(spec.keypress(choice)), signal)
		},
	}
}

export function UpdateActions(self: SmaartInstance): void {
	const actions: CompanionActionDefinitions<ActionSchema> = {
		[ActionId.ResetAverages]: requestAction(self, 'Reset Average', resetAveragesRequest),
		[ActionId.SelectTabByName]: {
			name: 'Select Tab By Name',
			options: [{ type: 'textinput', label: 'Tab Name', id: 'tabName', useVariables: true, minLength: 1 }],
			callback: async ({ options }, { signal }) =>
				self.send(selectTabRequest(textValue(options.tabName, 'Tab Name')), signal),
		},
		[ActionId.StartAllMeasurements]: {
			name: 'Start Measurements By Tab Name',
			options: [{ type: 'textinput', label: 'Tab Name', id: 'tabName', useVariables: true, minLength: 1 }],
			callback: async ({ options }, { signal }) =>
				self.send(startAllMeasurementsRequest(textValue(options.tabName, 'Tab Name')), signal),
		},
		[ActionId.StartGenerator]: requestAction(self, 'Start signal generator', () => generatorStateRequest(true)),
		[ActionId.StopGenerator]: requestAction(self, 'Stop signal generator', () => generatorStateRequest(false)),
		[ActionId.SetGeneratorLevel]: {
			name: 'Set Generator Level',
			options: [
				{
					type: 'number',
					label: 'Level (dB FS)',
					id: 'level',
					min: GENERATOR_LEVEL_MIN,
					max: GENERATOR_LEVEL_MAX,
					default: 0,
				},
			],
			callback: async ({ options }, { signal }) =>
				self.send(
					generatorLevelRequest(numberValue(options.level, GENERATOR_LEVEL_MIN, GENERATOR_LEVEL_MAX, 'Level')),
					signal,
				),
		},
		[ActionId.StartTrackingAll]: requestAction(self, 'Start delay tracking for current tab', () =>
			trackingStateRequest(true),
		),
		[ActionId.StopTrackingAll]: requestAction(self, 'Stop delay tracking for current tab', () =>
			trackingStateRequest(false),
		),
		[ActionId.ZoomX]: choiceKeypressAction(self, {
			name: 'Zoom X Axis',
			id: 'selectedDirection',
			label: 'Direction',
			tooltip: 'Which direction do you want?',
			choices: ZOOM_DIRECTIONS,
			default: ZOOM_DIRECTIONS[0].id,
			keypress: (direction) => 'option + command' + direction,
		}),
		[ActionId.ZoomY]: choiceKeypressAction(self, {
			name: 'Zoom Y Axis',
			id: 'selectedDirection',
			label: 'Direction',
			tooltip: 'Which direction do you want?',
			choices: ZOOM_DIRECTIONS,
			default: ZOOM_DIRECTIONS[0].id,
			keypress: (direction) => direction,
		}),
		[ActionId.ZoomXY]: choiceKeypressAction(self, {
			name: 'Zoom X & Y Axis',
			id: 'selectedDirection',
			label: 'Direction',
			tooltip: 'Which direction do you want?',
			choices: ZOOM_DIRECTIONS,
			default: ZOOM_DIRECTIONS[0].id,
			keypress: (direction) => 'command' + direction,
		}),
		[ActionId.SetZoomPreset]: choiceKeypressAction(self, {
			name: 'Set Zoom Preset',
			id: 'zoomPreset',
			label: 'Preset',
			tooltip: 'Which zoom preset do you want?',
			choices: ZOOM_PRESETS,
			default: ZOOM_PRESETS[0].id,
			keypress: (preset) => 'option + ' + preset,
		}),
		[ActionId.ArrowKeys]: choiceKeypressAction(self, {
			name: 'Send Arrow Keys',
			description: 'Smaart must have focus',
			id: 'selectedDirection',
			label: 'Direction',
			tooltip: 'Which direction do you want?',
			choices: ARROW_DIRECTIONS,
			default: ARROW_DIRECTIONS[0].id,
			keypress: (direction) => 'cursor ' + direction,
		}),
		[ActionId.CycleZOrder]: choiceKeypressAction(self, {
			name: 'Cycle Z Order',
			id: 'selectedDirection',
			label: 'Direction',
			tooltip: 'Which direction do you want?',
			choices: Z_ORDER_DIRECTIONS,
			default: Z_ORDER_DIRECTIONS[0].id,
			keypress: (direction) => Z_ORDER_KEYPRESSES[direction],
		}),
		[ActionId.HideTrace]: keypressAction(self, 'Hide Trace', 'H'),
		[ActionId.HideAllTraces]: keypressAction(self, 'Hide All Traces', 'shift + command + H'),
		[ActionId.TogglePeakHold]: keypressAction(self, 'Toggle Peak Hold', 'P'),
		[ActionId.ToggleInputMeters]: keypressAction(self, 'Toggle Input Meters', 'shift + E'),
		[ActionId.ToggleInputMeterOrientation]: keypressAction(
			self,
			'Toggle Input Meter Orientation',
			'shift + option + E',
		),
		[ActionId.ToggleSPLHistory]: keypressAction(self, 'Toggle SPL History', 'option + H'),
		[ActionId.ToggleMeters]: keypressAction(self, 'Toggle SPL Meters', 'E'),
		[ActionId.SelectViewPreset]: choiceKeypressAction(self, {
			name: 'Select View Preset',
			id: 'viewPreset',
			label: 'Preset',
			tooltip: 'Which view preset do you want?',
			choices: VIEW_PRESETS,
			default: VIEW_PRESETS[0].id,
			keypress: (preset) => preset,
		}),
		[ActionId.MoveFrontTrace]: choiceKeypressAction(self, {
			name: 'Trace Y Offset',
			id: 'selectedDirection',
			label: 'Direction',
			tooltip: 'Which direction do you want?',
			choices: TRACE_OFFSET_DIRECTIONS,
			default: TRACE_OFFSET_DIRECTIONS[0].id,
			keypress: (direction) => 'command + cursor ' + direction,
		}),
		[ActionId.ClearTraceOffset]: keypressAction(self, 'Clear Top Trace Y Offset', 'Y'),
		[ActionId.ClearAllTraceOffset]: keypressAction(self, 'Clear All Y Offsets', 'command + Y'),
		[ActionId.ToggleBar]: choiceKeypressAction(self, {
			name: 'Toggle Bar',
			id: 'selectedBar',
			label: 'Bar',
			tooltip: 'Which bar do you want to toggle?',
			choices: BARS,
			default: BARS[0].id,
			keypress: (bar) => bar,
		}),
		[ActionId.LockCursorToPeak]: keypressAction(self, 'Lock Cursor To Peak', 'command + P'),
		[ActionId.ClearLockedCursor]: keypressAction(self, 'Clear Locked Cursor', 'command + X'),
		[ActionId.MoveLockedCursor]: choiceKeypressAction(self, {
			name: 'Move Locked Cursor',
			id: 'selectedDirection',
			label: 'Direction',
			tooltip: 'Which direction do you want?',
			choices: LOCKED_CURSOR_DIRECTIONS,
			default: LOCKED_CURSOR_DIRECTIONS[0].id,
			keypress: (direction) => 'command + cursor ' + direction,
		}),
		[ActionId.CyclePlot]: keypressAction(self, 'Cycle Preferred Plot', 'M'),
		[ActionId.CaptureTrace]: {
			name: 'Capture Current Trace',
			options: [{ type: 'textinput', label: 'Trace Name', id: 'traceName', useVariables: true, minLength: 1 }],
			callback: async ({ options }, { signal }) =>
				self.send(captureTraceRequest(textValue(options.traceName, 'Trace Name')), signal),
		},
		[ActionId.RenameTrace]: {
			name: 'Rename Trace',
			options: [
				{
					type: 'textinput',
					label: 'Trace Name',
					id: 'traceName',
					useVariables: true,
					minLength: 1,
					tooltip: 'The new name of the trace',
				},
				{
					type: 'textinput',
					label: 'Trace File Path',
					id: 'tracePath',
					useVariables: true,
					minLength: 1,
					tooltip: 'Full path and filename of the trace to be renamed',
				},
			],
			callback: async ({ options }, { signal }) =>
				self.send(
					renameTraceRequest(
						textValue(options.traceName, 'Trace Name'),
						textValue(options.tracePath, 'Trace File Path'),
					),
					signal,
				),
		},
	}
	self.setActionDefinitions(actions)
}
