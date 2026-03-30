export default {
  testEnvironment: 'node',
  testMatch: ['**/test/unit/**/*.test.js'],
  collectCoverageFrom: [
    'lib/**/*.js',
    '!lib/tools.js'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
