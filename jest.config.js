module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  globalSetup: './tests/create-schema.ts',
  collectCoverageFrom: [
    'src/**/*.ts',
    'tests/**/*.ts',
  ]
}
