/**
 * Feature flags for institution program overlays.
 */

export interface ProgramModeFlag {
  /**
   * The unique identifier for the feature flag.
   */
  id: string;

  /**
   * The name of the feature flag.
   */
  name: string;

  /**
   * The description of the feature flag.
   */
  description?: string;

  /**
   * The default value of the feature flag.
   */
  defaultValue: boolean;
}

/**
 * Safe fallback values for program mode flags.
 */
export const SAFE_FALLBACK_VALUES: Record<string, ProgramModeFlag> = {
  "FLAG_1": {
    id: "FLAG_1",
    name: "Flag 1",
    defaultValue: true,
  },
  "FLAG_2": {
    id: "FLAG_2",
    name: "Flag 2",
    defaultValue: false,
  },
};
