import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import svelteParser from 'svelte-eslint-parser';
import obsidianmd from 'eslint-plugin-obsidianmd';
import promise from 'eslint-plugin-promise';
import unicorn from 'eslint-plugin-unicorn';

const typeCheckedRules = {
  '@typescript-eslint/await-thenable': 'error',
  '@typescript-eslint/no-floating-promises': 'error',
  '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: false }],
  '@typescript-eslint/no-unnecessary-boolean-literal-compare': 'error',
  '@typescript-eslint/no-unnecessary-type-arguments': 'error',
  '@typescript-eslint/no-unnecessary-type-assertion': 'error',
  '@typescript-eslint/no-unsafe-argument': 'error',
  '@typescript-eslint/no-unsafe-assignment': 'error',
  '@typescript-eslint/no-unsafe-call': 'error',
  '@typescript-eslint/no-unsafe-member-access': 'error',
  '@typescript-eslint/no-unsafe-return': 'error',
  '@typescript-eslint/no-unsafe-enum-comparison': 'error',
  '@typescript-eslint/prefer-includes': 'error',
  '@typescript-eslint/prefer-nullish-coalescing': 'error',
  '@typescript-eslint/prefer-readonly': 'error',
  '@typescript-eslint/return-await': ['error', 'error-handling-correctness-only'],
};

export default tseslint.config(
  {
    ignores: ['build/**', 'test-vault/**', 'node_modules/**', '*.js', '*.mjs', '*.cjs'],
  },

  js.configs.recommended,

  ...tseslint.configs.recommended,

  ...obsidianmd.configs.recommended,

  ...svelte.configs['flat/recommended'],

  {
    files: ['**/*.svelte'],
    languageOptions: {
      parser: svelteParser,
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.svelte'],
      },
    },
  },

  {
    files: ['**/*.ts', '**/*.svelte'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        activeDocument: 'readonly',
        activeWindow: 'readonly',
        require: 'readonly',
        module: 'readonly',
      },
    },
    plugins: {
      promise,
      unicorn,
    },
    rules: {
      'no-constant-binary-expression': 'error',

      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-duplicate-imports': 'off',
      'no-unused-expressions': ['error', { allowShortCircuit: true, enforceForJSX: true }],
      'no-unused-vars': 'off',
      'no-useless-concat': 'error',
      'no-useless-return': 'error',
      'prefer-promise-reject-errors': 'error',
      'prefer-rest-params': 'error',
      'prefer-spread': 'error',
      'sort-imports': ['error', {
        allowSeparatedGroups: true,
        ignoreDeclarationSort: true,
        ignoreCase: true,
      }],

      'promise/always-return': 'error',
      'promise/no-callback-in-promise': 'error',

      '@typescript-eslint/no-unused-vars': ['error', {
        vars: 'all',
        args: 'none',
        ignoreRestSiblings: true,
        caughtErrors: 'all',
        caughtErrorsIgnorePattern: '^_',
      }],
      '@typescript-eslint/no-useless-constructor': 'error',
      '@typescript-eslint/ban-ts-comment': ['error', {
        minimumDescriptionLength: 3,
        'ts-check': false,
        'ts-expect-error': 'allow-with-description',
        'ts-ignore': true,
        'ts-nocheck': true,
      }],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-confusing-non-null-assertion': 'error',
      '@typescript-eslint/no-extra-non-null-assertion': 'error',
      '@typescript-eslint/no-unnecessary-type-constraint': 'error',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-deprecated': 'off',

      'unicorn/consistent-empty-array-spread': 'error',
      'unicorn/consistent-existence-index-check': 'error',
      'unicorn/error-message': 'error',
      'unicorn/no-anonymous-default-export': 'error',
      'unicorn/no-array-push-push': 'off',
      'unicorn/no-length-as-slice-end': 'error',
      'unicorn/no-object-as-default-parameter': 'error',
      'unicorn/numeric-separators-style': 'error',
      'unicorn/prefer-array-find': 'error',
      'unicorn/prefer-array-flat': 'error',
      'unicorn/prefer-array-flat-map': 'error',
      'unicorn/prefer-array-some': 'error',
      'unicorn/prefer-date-now': 'error',
      'unicorn/prefer-includes': 'error',
      'unicorn/prefer-keyboard-event-key': 'error',
      'unicorn/prefer-math-min-max': 'error',
      'unicorn/prefer-native-coercion-functions': 'error',
      'unicorn/prefer-number-properties': 'error',
      'unicorn/prefer-regexp-test': 'error',
      'unicorn/prefer-string-slice': 'error',
      'unicorn/require-number-to-fixed-digits-argument': 'error',

      'svelte/require-each-key': 'warn',
      'svelte/no-at-html-tags': 'warn',
      'svelte/prefer-svelte-reactivity': 'warn',
      'svelte/prefer-writable-derived': 'warn',
      'svelte/no-unused-svelte-ignore': 'warn',
      'obsidianmd/settings-tab/prefer-setting-definitions': 'off',
    },
  },

  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.eslint.json',
      },
    },
    rules: typeCheckedRules,
  },
);
