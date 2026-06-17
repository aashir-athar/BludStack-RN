// Jest config for the BludStack mobile app.
// The suite targets pure logic - the blood-compatibility matrix, geo math, and
// zod schemas - the rules that must never silently drift. These modules have no
// React Native or Expo-module dependencies, so we skip the heavyweight jest-expo
// RN preset and transform with a minimal Babel pipeline (strip TS types, ESM ->
// CJS) in a node environment. moduleNameMapper mirrors the `@/*` alias; zod
// resolves to its CJS entry, so it needs no transform.
module.exports = {
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['<rootDir>/src/**/*.test.{ts,tsx}'],
  transform: {
    '^.+\\.[jt]sx?$': [
      'babel-jest',
      {
        babelrc: false,
        configFile: false,
        presets: ['@babel/preset-typescript'],
        plugins: ['@babel/plugin-transform-modules-commonjs'],
      },
    ],
  },
  collectCoverageFrom: [
    'src/utils/geo.ts',
    'src/constants/BloodData.ts',
    'src/schemas/index.ts',
    'src/utils/age.ts',
  ],
};
