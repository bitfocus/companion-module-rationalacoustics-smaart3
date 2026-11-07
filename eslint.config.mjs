import { generateEslintConfig } from '@companion-module/tools/eslint/config.mjs'
import tseslint from 'typescript-eslint'

const baseConfig = await generateEslintConfig({
	enableTypescript: true,
})

export default [
	...baseConfig,
	{
		// Not covered by tsconfig.json (which only includes src/**/*.ts), so parse it without type info
		files: ['vitest.config.ts'],
		...tseslint.configs.disableTypeChecked,
	},
	{
		// vitest and ws are devDependencies on purpose — tests aren't part of the published module
		files: ['src/__tests__/**/*.ts', 'vitest.config.ts'],
		rules: {
			'n/no-unpublished-import': 'off',
		},
	},
]
