export default async function (self) {
	self.setActionDefinitions({
		resetAvg: {
			name: 'Reset Average',
			options: [],
			callback: async (_action) => {
				await self.resetAvg()
			},
		},
		selectTabByName: {
			name: 'Select Tab By Name',
			options: [
				{
					type: 'textinput',
					label: 'Tab Name',
					id: 'tabName',
					useVariables: { local: true },
					required: true,
				},
			],
			callback: async (action, context) => {
				await self.selectTab(await context.parseVariablesInString(action.options.tabName))
			},
		},
		startAllMeasurements: {
			name: 'Start Measurements By Tab Name',
			options: [
				{
					type: 'textinput',
					label: 'Tab Name',
					id: 'tabName',
					useVariables: { local: true },
					required: true,
				},
			],
			callback: async (action, context) => {
				await self.startAllMeasurements(await context.parseVariablesInString(action.options.tabName))
			},
		},
		startGenerator: {
			name: 'Start signal generator',
			options: [],
			callback: async (_action) => {
				await self.generatorState(true)
			},
		},
		stopGenerator: {
			name: 'Stop signal generator',
			options: [],
			callback: async (_action) => {
				await self.generatorState(false)
			},
		},
		setGeneratorLevel: {
			name: 'Set Generator Level',
			options: [
				{
					type: 'number',
					label: 'Level (dB FS)',
					id: 'level',
					min: -200,
					max: 0,
					default: 0,
					required: true,
				},
			],
			callback: async (action) => {
				await self.setGeneratorLevel(action.options.level)
			},
		},
		startTrackingAll: {
			name: 'Start delay tracking for current tab',
			options: [],
			callback: async (_action) => {
				await self.trackingState(true)
			},
		},
		stopTrackingAll: {
			name: 'Stop delay tracking for current tab',
			options: [],
			callback: async (_action) => {
				await self.trackingState(false)
			},
		},
		zoomX: {
			name: 'Zoom X Axis',
			options: [
				{
					type: 'dropdown',
					label: 'Direction',
					id: 'selectedDirection',
					default: '+',
					tooltip: 'Which direction do you want?',
					choices: [
						{ id: '+', label: 'In' },
						{ id: '-', label: 'Out' },
					],
				},
			],
			callback: async (action) => {
				await self.issueCommand('option + command' + action.options.selectedDirection)
			},
		},
		zoomY: {
			name: 'Zoom Y Axis',
			options: [
				{
					type: 'dropdown',
					label: 'Direction',
					id: 'selectedDirection',
					default: '+',
					tooltip: 'Which direction do you want?',
					choices: [
						{ id: '+', label: 'In' },
						{ id: '-', label: 'Out' },
					],
				},
			],
			callback: async (action) => {
				await self.issueCommand(action.options.selectedDirection)
			},
		},
		zoomXY: {
			name: 'Zoom X & Y Axis',
			options: [
				{
					type: 'dropdown',
					label: 'Direction',
					id: 'selectedDirection',
					default: '+',
					tooltip: 'Which direction do you want?',
					choices: [
						{ id: '+', label: 'In' },
						{ id: '-', label: 'Out' },
					],
				},
			],
			callback: async (action) => {
				await self.issueCommand('command' + action.options.selectedDirection)
			},
		},
		setZoomPreset: {
			name: 'Set Zoom Preset',
			options: [
				{
					type: 'dropdown',
					label: 'Preset',
					id: 'zoomPreset',
					default: '5', //Default Zoom
					tooltip: 'Which zoom preset do you want?',
					choices: [
						{ id: '5', label: 'Default zoom' },
						{ id: '1', label: 'Zoom 1' },
						{ id: '2', label: 'Zoom 2' },
						{ id: '3', label: 'Zoom 3' },
						{ id: '4', label: 'Zoom 4' },
					],
				},
			],
			callback: async (action) => {
				await self.issueCommand('option + ' + action.options.zoomPreset)
			},
		},
		arrowKeys: {
			name: 'Send Arrow Keys',
			options: [
				{
					type: 'dropdown',
					label: 'Direction',
					id: 'selectedDirection',
					default: 'up',
					tooltip: 'Which direction do you want?',
					choices: [
						{ id: 'up', label: 'Up' },
						{ id: 'down', label: 'Down' },
						{ id: 'left', label: 'Left' },
						{ id: 'right', label: 'Right' },
					],
				},
			],
			callback: async (action) => {
				await self.issueCommand('cursor ' + action.options.selectedDirection)
			},
		},
		cycleZOrder: {
			name: 'Cycle Z Order',
			options: [
				{
					type: 'dropdown',
					label: 'Direction',
					id: 'selectedDirection',
					default: 'forward',
					tooltip: 'Which direction do you want?',
					choices: [
						{ id: 'forward', label: 'Forward' },
						{ id: 'backward', label: 'Backward' },
					],
				},
			],
			callback: async (action) => {
				if (action.options.selectedDirection == 'forward') {
					await self.issueCommand('Z')
				} else if (action.options.selectedDirection == 'backward') {
					await self.issueCommand('shift + Z')
				}
			},
		},
		hideTrace: {
			name: 'Hide Trace',
			options: [],
			callback: async (_action) => {
				await self.issueCommand('H')
			},
		},
		hideAllTraces: {
			name: 'Hide All Traces',
			options: [],
			callback: async (_action) => {
				await self.issueCommand('shift + command + H')
			},
		},
		togglePeakHold: {
			name: 'Toggle Peak Hold',
			options: [],
			callback: async (_action) => {
				await self.issueCommand('P')
			},
		},
		toggleInputMeters: {
			name: 'Toggle Input Meters',
			options: [],
			callback: async (_action) => {
				await self.issueCommand('shift + E')
			},
		},
		toggleInputMeterOrientation: {
			name: 'Toggle Input Meter Orientation',
			options: [],
			callback: async (_action) => {
				await self.issueCommand('shift + option + E')
			},
		},
		toggleSPLHistory: {
			name: 'Toggle SPL History',
			options: [],
			callback: async (_action) => {
				await self.issueCommand('option + H')
			},
		},
		toggleMeters: {
			name: 'Toggle SPL Meters',
			options: [],
			callback: async (_action) => {
				await self.issueCommand('E')
			},
		},
		selectViewPreset: {
			name: 'Select View Preset',
			options: [
				{
					type: 'dropdown',
					label: 'Preset',
					id: 'viewPreset',
					default: 'S', //Default Zoom
					tooltip: 'Which zoom preset do you want?',
					choices: [
						{ id: 'S', label: 'Spectrum' },
						{ id: 'T', label: 'Transfer' },
						{ id: '1', label: 'User View 1' },
						{ id: '2', label: 'User View 2' },
						{ id: '3', label: 'User View 3' },
						{ id: '4', label: 'User View 4' },
						{ id: '5', label: 'User View 5' },
						{ id: '6', label: 'User View 6' },
						{ id: '7', label: 'User View 7' },
						{ id: '8', label: 'User View 8' },
						{ id: '9', label: 'User View 9' },
						{ id: '0', label: 'Multi-Spectrum' },
					],
				},
			],
			callback: async (action) => {
				await self.issueCommand(action.options.viewPreset)
			},
		},
		moveFrontTrace: {
			name: 'Trace Y Offset',
			options: [
				{
					type: 'dropdown',
					label: 'Direction',
					id: 'selectedDirection',
					default: 'up',
					tooltip: 'Which direction do you want?',
					choices: [
						{ id: 'up', label: 'Up' },
						{ id: 'down', label: 'Down' },
					],
				},
			],
			callback: async (action) => {
				await self.issueCommand('command + cursor ' + action.options.selectedDirection)
			},
		},
		clearTraceOffset: {
			name: 'Clear Top Trace Y Offset',
			options: [],
			callback: async (_action) => {
				await self.issueCommand('Y')
			},
		},
		clearAllTraceOffset: {
			name: 'Clear All Y Offsets',
			options: [],
			callback: async (_action) => {
				await self.issueCommand('command + Y')
			},
		},
		toggleBar: {
			name: 'Toggle Bar',
			options: [
				{
					type: 'dropdown',
					label: 'Bar',
					id: 'selectedBar',
					default: 'O',
					tooltip: 'Which direction do you want?',
					choices: [
						{ id: 'O', label: 'Control' },
						{ id: 'U', label: 'Command' },
						{ id: 'B', label: 'Data' },
					],
				},
			],
			callback: async (action) => {
				await self.issueCommand(action.options.selectedBar)
			},
		},
		lockCursorToPeak: {
			name: 'Lock Cursor To Peak',
			options: [],
			callback: async (_action) => {
				await self.issueCommand('command + P')
			},
		},
		clearLockedCursor: {
			name: 'Clear Locked Cursor',
			options: [],
			callback: async (_action) => {
				await self.issueCommand('command + X')
			},
		},
		moveLockedCursor: {
			name: 'Move Locked Cursor',
			options: [
				{
					type: 'dropdown',
					label: 'Direction',
					id: 'selectedDirection',
					default: 'left',
					tooltip: 'Which direction do you want?',
					choices: [
						{ id: 'left', label: 'Left' },
						{ id: 'right', label: 'Right' },
					],
				},
			],
			callback: async (action) => {
				await self.issueCommand('command + cursor ' + action.options.selectedDirection)
			},
		},
		cyclePlot: {
			name: 'Cycle Preferred Plot',
			options: [],
			callback: async (_action) => {
				await self.issueCommand('M')
			},
		},
		captureTrace: {
			name: 'Capture Current Trace',
			options: [
				{
					type: 'textinput',
					label: 'Trace Name',
					id: 'traceName',
					useVariables: { local: true },
					required: true,
				},
			],
			callback: async (action, context) => {
				await self.captureTrace(await context.parseVariablesInString(action.options.traceName))
			},
		},
		renameTrace: {
			name: 'Rename Trace',
			options: [
				{
					type: 'textinput',
					label: 'Trace Name',
					id: 'traceName',
					useVariables: { local: true },
					required: true,
					tooltip: 'The new name of the trace',
				},
				{
					type: 'textinput',
					label: 'Trace File Path',
					id: 'tracePath',
					useVariables: { local: true },
					required: true,
					tooltip: 'Full path and filename of the trace to be renamed',
				},
			],
			callback: async (action, context) => {
				await self.renameTrace(
					await context.parseVariablesInString(action.options.traceName),
					await context.parseVariablesInString(action.options.tracePath),
				)
			},
		},
	})
}
