import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		exclude: ['**/node_modules/**', '**/dist/**'],
		environment: 'node',
		include: ['src/**/*.spec.ts'],
		coverage: {
			provider: 'v8',
			// text for the CI log, lcov for Codecov (test.yaml uploads ./coverage/lcov.info), html for browsing locally
			reporter: ['text', 'lcov', 'html'],
			reportsDirectory: './coverage',
			include: ['src/**/*.ts'],
			exclude: ['src/__tests__/**'],
		},
	},
})
