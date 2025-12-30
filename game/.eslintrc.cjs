module.exports = {
  root: true,
  env: {
    browser: true,
    es2020: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  settings: { react: { version: '18.2' } },
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    'no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      },
    ],
  },
  globals: {
    vi: 'readonly',
    describe: 'readonly',
    it: 'readonly',
    expect: 'readonly',
    beforeEach: 'readonly',
    afterEach: 'readonly',
    test: 'readonly',
  },
  overrides: [
    {
      files: ['playwright.config.js', 'vite.config.js'],
      env: {
        node: true,
      },
      globals: {
        process: 'readonly',
      },
    },
    {
      files: ['**/*.test.js', '**/*.test.jsx', '**/test/**/*.js', '**/test/**/*.jsx'],
      globals: {
        global: 'readonly',
      },
    },
  ],
};
