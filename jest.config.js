export default {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/unit/**/*.test.js'],
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
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
