module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  testEnvironmentOptions: {
    url: 'http://127.0.0.1/',
  },
  testMatch: ['<rootDir>/specs/rum.simple.test.ts'],
  collectCoverage: false,
  setupFilesAfterEnv: ['<rootDir>/../setup.ts', '<rootDir>/setup.ts'],
  moduleNameMapper: {
    '^@src/(.*)$': '<rootDir>/../../src/$1',
    '^uuid$': '<rootDir>/../unit/__utils__/uuidMock.ts',
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
  testTimeout: 15000,
};
