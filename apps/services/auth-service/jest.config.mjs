/**
 * ESM jest config. Run with NODE_OPTIONS=--experimental-vm-modules (see package.json).
 * ESM mode is required because `jose` ships ESM-only; ts-jest transpiles our TS to ESM so
 * those imports resolve natively.
 */
export default {
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    // allow ESM-style ".js" relative imports to resolve to ".ts" sources
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: { module: 'esnext', moduleResolution: 'bundler', verbatimModuleSyntax: false },
      },
    ],
  },
};
