export default {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/', '.claude/worktrees'],
  cacheDirectory: '<rootDir>/.jest-cache',
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {},
  collectCoverageFrom: [
    'lib/**/*.js',
    '!lib/tools.js'
  ],
  coverageThreshold: {
    global: {
      branches: 15,
      functions: 15,
      lines: 15,
      statements: 15
    }
  }
};
