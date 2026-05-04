/**
 * ESLint-конфиг для NestJS-приложений: добавляет правила, специфичные
 * для декораторов, DTO и инъекции зависимостей.
 */
const base = require('./index.js');
const tsParser = require('@typescript-eslint/parser');

module.exports = [
  ...base,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2023,
        sourceType: 'module',
      },
    },
    rules: {
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-empty-function': [
        'warn',
        { allow: ['constructors', 'decoratedFunctions'] },
      ],
    },
  },
  {
    files: ['**/*.spec.ts', '**/*.e2e-spec.ts', '**/test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },
];
