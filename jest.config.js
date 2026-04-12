export default {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/**/*.test.js'],
  roots: ['<rootDir>/test'],
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
      statements: 80,
      branches: 70,
      functions: 80,
      lines: 80
    }
  }
};
