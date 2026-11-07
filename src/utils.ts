import type { DropdownChoice } from '@companion-module/base'

/** The message of anything thrown, which need not be an Error */
export function errorMessage(err: unknown): string {
	return err instanceof Error ? err.message : String(err)
}

/**
 * An option's value, checked against its choices. Companion skips an action whose value is not one of them, but base
 * still asks modules to check, and a value saved by an older version may no longer be offered. A number is taken as
 * the id it spells, as Companion does, so an expression returning 3 picks the choice '3'.
 * @throws if the value is not one of the choices
 */
export function choiceValue<TId extends string>(
	choices: readonly DropdownChoice<TId>[],
	value: unknown,
	label: string,
): TId {
	const id = typeof value === 'number' ? String(value) : value
	const choice = choices.find((c) => c.id === id)
	if (choice === undefined) throw new Error(`${label} ${String(value)} is not valid`)
	return choice.id
}

/**
 * What an expression for a dropdown has to return, as its ids are not what the dropdown shows. They are quoted, as an
 * expression must quote them: unquoted, `O` is an unknown name and `+` a syntax error
 */
export function choicesExpressionDescription(choices: readonly DropdownChoice<string>[]): string {
	return `The expression must return one of: ${choices.map((c) => `'${c.id}' (${c.label})`).join(', ')}`
}

/**
 * A text option's value. Companion has already parsed any variables in it, or evaluated it as an expression.
 * @throws if it is empty
 */
export function textValue(value: unknown, label: string): string {
	const text = typeof value === 'string' ? value : typeof value === 'number' ? String(value) : ''
	if (text === '') throw new Error(`${label} is empty`)
	return text
}

/**
 * A number option's value, clamped to its range. Companion skips an expression out of range, but nothing checks a
 * value saved by an older version.
 * @throws if it is not a number
 */
export function numberValue(value: unknown, min: number, max: number, label: string): number {
	if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${label} ${String(value)} is not valid`)
	return Math.min(Math.max(value, min), max)
}
