// tslint:disable:no-any strict-type-checking no-object-literal-keys-are-number

import { MlEnabled } from '../ml/ml-enabled';
import { AuditHash } from '../audit-hash';

export function m01(
  state: any,
  ml_enabled: MlEnabled = false,
): [number, number] {
  if (ml_enabled) {
    const output = Math.random();
    return [output, AuditHash.hash(output)];
  }
  return [0.5, AuditHash.hash(0.5)];
}

export function m02(
  state: any,
  ml_enabled: MlEnabled = false,
): [number, number] {
  if (ml_enabled) {
    const output = Math.random();
    return [output, AuditHash.hash(output)];
  }
  return [0.3, AuditHash.hash(0.3)];
}

export function m03(
  state: any,
  ml_enabled: MlEnabled = false,
): [number, number] {
  if (ml_enabled) {
    const output = Math.random();
    return [output, AuditHash.hash(output)];
  }
  return [0.7, AuditHash.hash(0.7)];
}

export function m04(
  state: any,
  ml_enabled: MlEnabled = false,
): [number, number] {
  if (ml_enabled) {
    const output = Math.random();
    return [output, AuditHash.hash(output)];
  }
  return [0.2, AuditHash.hash(0.2)];
}

export function m05(
  state: any,
  ml_enabled: MlEnabled = false,
): [number, number] {
  if (ml_enabled) {
    const output = Math.random();
    return [output, AuditHash.hash(output)];
  }
  return [0.9, AuditHash.hash(0.9)];
}

export function m06(
  state: any,
  ml_enabled: MlEnabled = false,
): [number, number] {
  if (ml_enabled) {
    const output = Math.random();
    return [output, AuditHash.hash(output)];
  }
  return [0.1, AuditHash.hash(0.1)];
}

export function m07(
  state: any,
  ml_enabled: MlEnabled = false,
): [number, number] {
  if (ml_enabled) {
    const output = Math.random();
    return [output, AuditHash.hash(output)];
  }
  return [0.8, AuditHash.hash(0.8)];
}

export function m08(
  state: any,
  ml_enabled: MlEnabled = false,
): [number, number] {
  if (ml_enabled) {
    const output = Math.random();
    return [output, AuditHash.hash(output)];
  }
  return [0.4, AuditHash.hash(0.4)];
}

export function m09(
  state: any,
  ml_enabled: MlEnabled = false,
): [number, number] {
  if (ml_enabled) {
    const output = Math.random();
    return [output, AuditHash.hash(output)];
  }
  return [0.6, AuditHash.hash(0.6)];
}

export function m10(
  state: any,
  ml_enabled: MlEnabled = false,
): [number, number] {
  if (ml_enabled) {
    const output = Math.random();
    return [output, AuditHash.hash(output)];
  }
  return [0.5, AuditHash.hash(0.5)];
}

export function m11(
  state: any,
  ml_enabled: MlEnabled = false,
): [number, number] {
  if (ml_enabled) {
    const output = Math.random();
    return [output, AuditHash.hash(output)];
  }
  return [0.3, AuditHash.hash(0.3)];
}

export function m12(
  state: any,
  ml_enabled: MlEnabled = false,
): [number, number] {
  if (ml_enabled) {
    const output = Math.random();
    return [output, AuditHash.hash(output)];
  }
  return [0.7, AuditHash.hash(0.7)];
}
