module.exports = {
  testEnvironment: 'jsdom',
  testMatch: ['**/modules/**/*.test.js', '**/integration.test.js'],
  verbose: true,
  setupFilesAfterEnv: [
    'whatwg-fetch',
    '<rootDir>/node_modules/jest-chrome/lib/index.cjs.js'
  ],
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  transformIgnorePatterns: [
    '/node_modules/(?!jest-chrome)/',
  ],
  // If facing issues with ES module syntax specifically, uncommenting this might help
  // extensionsToTreatAsEsm: ['.js'], 
  // moduleNameMapper: { // If using module aliases 
  //   '^@/(.*)$': '<rootDir>/src/$1',
  // },
};