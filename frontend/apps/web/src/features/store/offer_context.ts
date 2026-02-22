/**
 * OfferContext class for managing client-side offer context signals.
 */

import { Dispatch, SetStateAction } from 'react';

export interface OfferContextData {
  postWipe: boolean;
  onboarding: boolean;
  timerCritical: number; // Unix timestamp in milliseconds
}

/**
 * OfferContext class with state and functions to manage offer context signals.
 */
class OfferContext {
  private _data: OfferContextData = {
    postWipe: false,
    onboarding: false,
    timerCritical: 0,
  };

  /**
   * Set the post-wipe state.
   * @param postWipe - The new post-wipe state.
   */
  public setPostWipe(postWipe: boolean): void {
    this._data.postWipe = postWipe;
  }

  /**
   * Set the onboarding state.
   * @param onboarding - The new onboarding state.
   */
  public setOnboarding(onboarding: boolean): void {
    this._data.onboarding = onboarding;
  }

  /**
   * Set the timer-critical Unix timestamp in milliseconds.
   * @param timerCritical - The new timer-critical timestamp.
   */
  public setTimerCritical(timerCritical: number): void {
    this._data.timerCritical = timerCritical;
  }

  /**
   * Get the current offer context data.
   * @returns The current offer context data.
   */
  public getData(): OfferContextData {
    return { ...this._data };
  }

  /**
   * Set the offer context data and notify the parent component of a change.
   * @param newData - The new offer context data.
   * @param setState - The setState function from the parent component.
   */
  public updateAndNotify(newData: OfferContextData, setState: Dispatch<SetStateAction<OfferContext>>): void {
    this._data = { ...this._data, ...newData };
    setState({ ...this });
  }
}

export const offerContext = new OfferContext();
