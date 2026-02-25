// pzo-web/vitest.config.ts - Vitest configuration for fake timers and strict TypeScript execution
import { defineConfig } from 'vitest';
import ts from '@ts-jest/preset-typescript';

export default defineConfig({
  roots: ['<rootDir>/src'], // Assuming tests are in the src directory. Adjust as necessary.
  globals: true,
  testEnvironment: 'node',
  preset: ts,
  setupFiles: ['./jest-setup.ts'], // Custom setup file for Jest if needed (e.g., to mock global timers).
});
