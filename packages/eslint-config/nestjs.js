/** @type {import("eslint").Linter.Config} */
module.exports = {
  ...require('./base'),
  env: {
    node: true,
    es2020: true,
  },
  rules: {
    ...require('./base').rules,
    // NestJS uses decorators extensively — these are expected patterns
    '@typescript-eslint/no-explicit-any': 'warn',
  },
}
