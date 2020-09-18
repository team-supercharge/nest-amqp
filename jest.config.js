module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  collectCoverage: true,
  coverageDirectory: '../coverage',
  coverageReporters: ['text'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
  testRegex: '.spec.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  testEnvironment: 'node',
};
