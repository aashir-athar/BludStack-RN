'use strict';

// Backend test config. The API is plain CommonJS, so Jest runs it directly in a
// node environment with no transform. --runInBand keeps the supertest app import
// (which wires the whole middleware stack) deterministic.
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/__tests__/**/*.test.js'],
  collectCoverageFrom: ['src/utils/**/*.js', 'src/middleware/**/*.js'],
  // The supertest import boots the full app; give async handlers room and force
  // exit so a lingering Supabase keep-alive socket can't hang the run.
  testTimeout: 15000,
  forceExit: true,
};
