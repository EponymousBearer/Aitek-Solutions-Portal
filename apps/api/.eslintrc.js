module.exports = {
  ...require('@aitek/eslint-config/nestjs'),
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
}
