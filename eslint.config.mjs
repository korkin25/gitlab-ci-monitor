import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

// Flat config (ESLint 10). Prettier owns formatting, so `eslint-config-prettier`
// is applied last to switch off every rule that would fight it.
export default tseslint.config(
	{
		ignores: ['out/**', 'out-test/**', 'node_modules/**', '**/*.js', '**/*.mjs', '*.vsix']
	},
	js.configs.recommended,
	...tseslint.configs.recommended,
	{
		languageOptions: {
			globals: { ...globals.node }
		},
		rules: {
			// The tree items are untyped VS Code payloads; `any` is deliberate here.
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-unused-vars': [
				'warn',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }
			],
			// The ANSI/log cleaner matches terminal control characters on purpose.
			'no-control-regex': 'off',
			'no-empty': ['error', { allowEmptyCatch: true }]
		}
	},
	prettier
);
