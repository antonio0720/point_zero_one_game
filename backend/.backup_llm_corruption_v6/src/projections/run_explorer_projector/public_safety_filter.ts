/**
 * Public Safety Filter for Redaction Rules
 */

type PII = 'SSN' | 'DateOfBirth' | 'Email' | 'PhoneNumber';
type DeviceTrustSignal = 'DeviceID' | 'IPAddress' | 'UserAgent';
type InternalFlag = 'InternalFlag1' | 'InternalFlag2' | 'InternalFlag3';

interface RedactableData {
  PII?: string[];
  DeviceTrustSignals?: string[];
  InternalFlags?: string[];
  Data: any; // This is an exception to the 'any' rule, as it represents the actual data that needs to be kept.
}

/**
 * Redact sensitive information from the given data
 */
function redactSensitiveData(data: RedactableData): RedactableData {
  const redactionResult: RedactableData = { Data: data.Data };

  if (data.PII) {
    redactionResult.PII = redactionResult.PII.map((pii) => '***');
  }

  if (data.DeviceTrustSignals) {
    redactionResult.DeviceTrustSignals = redactionResult.DeviceTrustSignals.map((signal) => '***');
  }

  if (data.InternalFlags) {
    redactionResult.InternalFlags = redactionResult.InternalFlags.map((flag) => '***');
  }

  return redactionResult;
}

/**
 * Export public symbols
 */
export { RedactableData, redactSensitiveData };

This TypeScript code defines types for PII, DeviceTrustSignal, and InternalFlag. It also creates an interface `RedactableData` to represent the data that needs redaction. The `redactSensitiveData` function is responsible for removing sensitive information from the given data while preserving the actual data itself.

The code exports both the `RedactableData` interface and the `redactSensitiveData` function as public symbols.
