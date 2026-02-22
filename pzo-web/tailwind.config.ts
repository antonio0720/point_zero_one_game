// @ts-check

const path = require('path');

module.exports = {
  mode: 'jit',
  purge: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  theme: {
    extend: {},
  },
  variants: {},
  plugins: [],
  future: {
    removeDeprecatedGapUtilities: true,
  },
  // Enable postcss
  // See https://tailwindcss.com/docs/guides/creating-a-custom-configuration#postcss
  // config: 'postcss.config.js',
};

// ML models
const mlEnabled = process.env.ML_ENABLED === 'true';
if (!mlEnabled) {
  console.warn('ML features are disabled.');
}

module.exports.mlEnabled = mlEnabled;

module.exports.boundedOutputs = (output: number): number => Math.min(Math.max(output, 0), 1);

// Audit hash
const auditHash = process.env.AUDIT_HASH;
if (!auditHash) {
  throw new Error('AUDIT_HASH environment variable is not set.');
}

module.exports.auditHash = auditHash;

// Engine
process.env.NODE_ENV = 'production';

// Preserve determinism
process.env.DETERMINISTIC_ENGINE = true;
