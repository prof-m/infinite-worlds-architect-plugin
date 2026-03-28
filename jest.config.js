export default {
  testEnvironment: 'node',
  testMatch: ['**/test/unit/**/*.test.js'],
  collectCoverageFrom: [
    'lib/handlers/**/*.js',
    'lib/helpers.js',
    '!lib/**/*.test.js'
  ],
  coverageThreshold: {
    'lib/handlers/': {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  moduleFileExtensions: ['js'],
  verbose: true,
  testTimeout: 10000,
  setupFilesAfterEnv: ['<rootDir>/test/setup.js']
};
