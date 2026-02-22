/**
 * Privacy settings for a run in Point Zero One Digital's financial roguelike game.
 */

type Visibility = 'Public' | 'Unlisted' | 'Private';

interface RunPrivacy {
  /** The current visibility setting for the run. */
  visibility: Visibility;
}

/**
 * Initial state for run privacy settings.
 */
const initialState: RunPrivacy = {
  visibility: 'Unlisted',
};

/**
 * Action types for updating run privacy settings.
 */
enum PrivacyActionType {
  SET_VISIBILITY = 'SET_VISIBILITY',
}

/**
 * Action payloads for updating run privacy settings.
 */
interface SetVisibilityAction {
  type: PrivacyActionType.SET_VISIBILITY;
  visibility: Visibility;
}

type PrivacyActions = SetVisibilityAction;

/**
 * Reducer for managing run privacy settings.
 */
const privacyReducer = (state: RunPrivacy = initialState, action: PrivacyActions): RunPrivacy => {
  switch (action.type) {
    case PrivacyActionType.SET_VISIBILITY:
      return { ...state, visibility: action.visibility };
    default:
      throw new Error(`Unhandled action type: ${action.type}`);
  }
};

/**
 * Component for managing run privacy settings in the game UI.
 */
const PrivacySettings = () => {
  // ... (UI implementation details omitted)
};

export { Privacy, Visibility, RunPrivacy, initialState, PrivacyActionType, SetVisibilityAction, privacyReducer, PrivacySettings };
