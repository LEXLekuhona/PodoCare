const base = require('@podocare/eslint-config');
const globals = require('globals');

module.exports = [
  ...base,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
];
