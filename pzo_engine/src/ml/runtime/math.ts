// pzo_engine/src/ml/runtime/math.ts
// Density6 LLC · Point Zero One · Confidential

export function clamp(x: number, lo: number, hi: number): number {
  if (x < lo) return lo;
  if (x > hi) return hi;
  return x;
}

export function sigmoid(z: number): number {
  // numerically stable sigmoid
  if (z >= 0) {
    const ez = Math.exp(-z);
    return 1 / (1 + ez);
  }
  const ez = Math.exp(z);
  return ez / (1 + ez);
}

export function dot(a: readonly number[], b: readonly number[]): number {
  const n = Math.min(a.length, b.length);
  let s = 0;
  for (let i = 0; i < n; i++) s += a[i] * b[i];
  return s;
}

export function softplus(x: number): number {
  // stable log(1+exp(x))
  if (x > 20) return x;
  if (x < -20) return Math.exp(x);
  return Math.log1p(Math.exp(x));
}