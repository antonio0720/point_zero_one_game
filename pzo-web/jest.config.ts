// pzo-web/jest.config.ts - Configuration specifics for Vitest and jest integration, including fake timers support
import { defineConfig } from 'jest';
import ts from '@ts-jest/preset-typescript';

export default defineConfig({
  roots: ['<rootDir>/src'], // Assuming tests are in the src directory. Adjust as necessary.
  testMatch: ['**/*.test.(ts|js)', '!**/*.spec.ts'], // Exclude spec files if they exist, otherwise include them for both Vitest and Jest to run together without conflict.
  transform: {
    ...(process.env.ROLLUP_WATCH || process.env.CI === 'true'), // Use ts-jest preset only when in CI or watching mode (rollup watch).
    '.+\\.(ts|tsx)?$': 'ts-jest',
  },
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/src/jest-setup.ts'], // Custom setup file for Jest if needed, similar to Vitest's but with jest specific configurations like mocking global timers or other Node globals.
});
