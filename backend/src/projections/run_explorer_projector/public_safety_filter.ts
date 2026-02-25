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

