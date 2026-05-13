/** @type {import("eslint").Linter.Config} */
module.exports = {
  ...require('./base'),
  extends: [
    ...require('./base').extends,
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'next/core-web-vitals',
  ],
  plugins: [...require('./base').plugins, 'react', 'react-hooks'],
  settings: {
    react: { version: 'detect' },
  },
  rules: {
    ...require('./base').rules,
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    // Allow React and Next imports at top regardless of alphabetical order
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        pathGroups: [
          { pattern: 'react', group: 'builtin', position: 'before' },
          { pattern: 'react-dom', group: 'builtin', position: 'before' },
          { pattern: 'next', group: 'builtin', position: 'before' },
          { pattern: 'next/**', group: 'builtin', position: 'before' },
        ],
        pathGroupsExcludedImportTypes: ['react', 'react-dom'],
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true },
      },
    ],
  },
  env: {
    browser: true,
    es2020: true,
  },
}
