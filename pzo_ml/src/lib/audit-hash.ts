export function sharedAuditHash(inputs: { [key: string]: number }, outputs: { [key: string]: number }, modelId: string, rulesetVersion: string): string {
  const canonicalJson = JSON.stringify({ inputs, outputs, model_id: modelId, ruleset_version: rulesetVersion });
  return crypto.createHash('sha256').update(canonicalJson).digest('hex');
}

export function mlAuditHash(inputs: { [key: string]: number }, outputs: { [key: string]: number }, modelId: string, rulesetVersion: string): boolean {
  const hash = sharedAuditHash(inputs, outputs, modelId, rulesetVersion);
  return hash === 'your_expected_hash_here';
}

export function mlEnabled(): boolean {
  // Replace with your actual logic to determine if ML is enabled
  return true;
}
