module.exports = {
  ...require('@aitek/eslint-config/nextjs'),
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
}
