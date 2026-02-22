/**
 * DebriefPrompt contract for Point Zero One Digital's financial roguelike game.
 */

export interface DebriefPrompt {
  promptId: string;
  tags: string[];
  severity: number;
  audience: string;
}

/**
 * DebriefPrompt schema validation function.
 * @param data - The data to validate against the DebriefPrompt schema.
 */
export function validateDebriefPrompt(data: any): data is DebriefPrompt {
  return (
    typeof data.promptId === 'string' &&
    Array.isArray(data.tags) &&
    typeof data.severity === 'number' &&
    typeof data.audience === 'string'
  );
}
