import type { DropdownChoice } from '@companion-module/base'

/**
 * Dropdown choices. The ids are saved against every button using them, so they must never change. Most are the key
 * Smaart is sent, or the part of it after the modifiers.
 */

type Choices = readonly DropdownChoice<string>[]
type ChoiceId<T extends Choices> = T[number]['id']

export const ZOOM_DIRECTIONS = [
	{ id: '+', label: 'In' },
	{ id: '-', label: 'Out' },
] as const satisfies Choices
export type ZoomDirection = ChoiceId<typeof ZOOM_DIRECTIONS>

/** Option + the id. Option + 5 is Smaart's default zoom */
export const ZOOM_PRESETS = [
	{ id: '5', label: 'Default zoom' },
	{ id: '1', label: 'Zoom 1' },
	{ id: '2', label: 'Zoom 2' },
	{ id: '3', label: 'Zoom 3' },
	{ id: '4', label: 'Zoom 4' },
] as const satisfies Choices
export type ZoomPreset = ChoiceId<typeof ZOOM_PRESETS>

export const ARROW_DIRECTIONS = [
	{ id: 'up', label: 'Up' },
	{ id: 'down', label: 'Down' },
	{ id: 'left', label: 'Left' },
	{ id: 'right', label: 'Right' },
] as const satisfies Choices
export type ArrowDirection = ChoiceId<typeof ARROW_DIRECTIONS>

/** Not sent as they are: Z cycles forward, Shift + Z backward */
export const Z_ORDER_DIRECTIONS = [
	{ id: 'forward', label: 'Forward' },
	{ id: 'backward', label: 'Backward' },
] as const satisfies Choices
export type ZOrderDirection = ChoiceId<typeof Z_ORDER_DIRECTIONS>

export const VIEW_PRESETS = [
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
] as const satisfies Choices
export type ViewPreset = ChoiceId<typeof VIEW_PRESETS>

export const TRACE_OFFSET_DIRECTIONS = [
	{ id: 'up', label: 'Up' },
	{ id: 'down', label: 'Down' },
] as const satisfies Choices
export type TraceOffsetDirection = ChoiceId<typeof TRACE_OFFSET_DIRECTIONS>

export const BARS = [
	{ id: 'O', label: 'Control' },
	{ id: 'U', label: 'Command' },
	{ id: 'B', label: 'Data' },
] as const satisfies Choices
export type Bar = ChoiceId<typeof BARS>

export const LOCKED_CURSOR_DIRECTIONS = [
	{ id: 'left', label: 'Left' },
	{ id: 'right', label: 'Right' },
] as const satisfies Choices
export type LockedCursorDirection = ChoiceId<typeof LOCKED_CURSOR_DIRECTIONS>
