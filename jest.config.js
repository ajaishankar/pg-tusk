module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  globalSetup: './tests/globalSetup.ts',
  collectCoverageFrom: [
    'src/**/*.ts',
    'tests/**/*.ts',
  ]
}
