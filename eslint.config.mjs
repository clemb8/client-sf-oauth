// ESLint flat configuration. Replaces the deprecated tslint setup.
//
// Baseline: ESLint recommended + typescript-eslint recommended.
//
// The four rules the previous `tslint.json` explicitly disabled stay disabled
// here, so migrating the linter produces no unrelated style churn on top of the
// security changes in this change set:
//   trailing-comma        -> comma-dangle
//   no-console            -> no-console
//   no-shadowed-variable  -> no-shadow / @typescript-eslint/no-shadow
//   prefer-for-of         -> @typescript-eslint/prefer-for-of
import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'examples/**/node_modules/**'],
  },
  js.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        project: false,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,

      // TypeScript's own compiler already reports undefined identifiers, and
      // `no-undef` cannot see ambient lib globals such as `URLSearchParams`.
      // Disabling it on TS files is the typescript-eslint project's own
      // documented guidance, not a relaxation of this project's baseline.
      'no-undef': 'off',

      // Carried over from tslint.json — intentionally off.
      'comma-dangle': 'off',
      'no-console': 'off',
      'no-shadow': 'off',
      '@typescript-eslint/no-shadow': 'off',
      '@typescript-eslint/prefer-for-of': 'off',

      // `no-unused-vars` must be delegated to the TS-aware rule, otherwise the
      // core rule reports false positives on type-only identifiers.
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
];
