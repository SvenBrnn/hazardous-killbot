import { defineConfig, globalIgnores } from 'eslint/config';
import _import from 'eslint-plugin-import';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import { fixupPluginRules } from '@eslint/compat';
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';
import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// eslint-disable-next-line no-redeclare
const __filename = fileURLToPath(import.meta.url);
// eslint-disable-next-line no-redeclare
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all,
});

export default defineConfig([globalIgnores(['**/dist']), {
    extends: compat.extends('eslint:recommended', 'plugin:@typescript-eslint/recommended'),

    plugins: {
        import: fixupPluginRules(_import),
        '@typescript-eslint': typescriptEslint,
    },

    languageOptions: {
        globals: {
            ...globals.node,
        },

        parser: tsParser,
        ecmaVersion: 'latest',
        sourceType: 'commonjs',
    },

    rules: {
        'arrow-spacing': ['warn', {
            before: true,
            after: true,
        }],

        'brace-style': ['error', 'stroustrup', {
            allowSingleLine: true,
        }],

        'comma-dangle': ['error', 'always-multiline'],
        'comma-spacing': 'error',
        'comma-style': 'error',
        curly: ['error', 'multi-line', 'consistent'],
        'dot-location': ['error', 'property'],
        'handle-callback-err': 'off',
        indent: ['error', 4],
        'keyword-spacing': 'error',

        'max-nested-callbacks': ['error', {
            max: 4,
        }],

        'max-statements-per-line': ['error', {
            max: 2,
        }],

        'no-console': 'off',
        'no-empty-function': 'error',
        'no-floating-decimal': 'error',
        'no-lonely-if': 'error',
        'no-multi-spaces': 'error',

        'no-multiple-empty-lines': ['error', {
            max: 2,
            maxEOF: 1,
            maxBOF: 0,
        }],

        'no-trailing-spaces': ['error'],
        'no-var': 'error',
        'object-curly-spacing': ['error', 'always'],
        'prefer-const': 'error',
        quotes: ['error', 'single'],
        semi: ['error', 'always'],
        'space-before-blocks': 'error',

        'space-before-function-paren': ['error', {
            anonymous: 'never',
            named: 'never',
            asyncArrow: 'always',
        }],

        'space-in-parens': 'error',
        'space-infix-ops': 'error',
        'space-unary-ops': 'error',
        'spaced-comment': 'error',
        yoda: 'error',

        'import/order': [1, {
            groups: ['external', 'builtin', 'internal', 'sibling', 'parent', 'index'],
        }],

        '@typescript-eslint/no-unused-vars': ['error', {
            vars: 'all',
            args: 'none',
            ignoreRestSiblings: false,
        }],

        '@typescript-eslint/no-explicit-any': ['off'],
    },
}]);