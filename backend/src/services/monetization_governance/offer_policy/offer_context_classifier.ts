/**
 * OfferContextClassifier class for classifying contexts based on given rules.
 */
export class OfferContextClassifier {
  /**
   * Classifies a given context and returns the corresponding category.
   * @param context - The context to be classified.
   * @returns The categorized context.
   */
  public classify(context: string): string {
    switch (context) {
      case 'post-wipe':
        return 'postWipe';
      case 'timer-critical':
        return 'timerCritical';
      case 'onboarding':
        return 'onboarding';
      case 'seasonHub':
        return 'seasonHub';
      case 'store':
        return 'store';
      default:
        throw new Error(`Invalid context provided: ${context}`);
    }
  }
}
