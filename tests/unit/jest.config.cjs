module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  testEnvironmentOptions: {
    url: 'http://127.0.0.1/',
  },
  testMatch: ['**/*.test.ts'],
  collectCoverage: true,
  coverageReporters: ['text'],
  coveragePathIgnorePatterns: ['/node_modules/', '/tests/'],
  setupFilesAfterEnv: ['<rootDir>/../setup.ts'],
  moduleNameMapper: {
    '^@src/(.*)$': '<rootDir>/../../src/$1',
    '^uuid$': '<rootDir>/__utils__/uuidMock.ts',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/../../tsconfig.json',
        isolatedModules: false,
      },
    ],
  },
  transformIgnorePatterns: ['/node_modules/(?!(uuid|@opentelemetry)/)'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  collectCoverageFrom: ['<rootDir>/../../src/**/*.ts', '!<rootDir>/../../src/**/*.d.ts'],
};
