# 02_onboarding_60s_identity_flow

## Overview

This document outlines the step-by-step user experience (UX) for the 60-second onboarding flow in Sovereign, focusing on the identity claim, bind, reveal, and subsequent actions, as well as optional sharing. The UX is designed to be intuitive, efficient, and adhere to strict quality of life (QoL) rules and copy states.

## Non-negotiables

1. Claim: Users must be able to claim their unique identity within the Sovereign ecosystem.
2. Bind: Users must securely bind their identity to a chosen digital wallet or account.
3. Reveal: Users should have the option to reveal their identity, but this is not mandatory.
4. Next Action: Upon successful onboarding, users should be directed to the next appropriate action within the Sovereign platform.
5. Optional Share: Users should have the ability to share their identity with other trusted parties if desired.
6. Strict TypeScript: All code adheres to strict TypeScript mode and never uses 'any'.
7. Deterministic Effects: All effects within the onboarding flow are deterministic, ensuring consistency across all user experiences.

## Implementation Spec

### Claim

1. Display a clear call-to-action (CTA) for users to claim their identity.
2. Guide users through a simple verification process to confirm their identity.
3. Provide feedback on the success or failure of the identity claim.

### Bind

1. Offer users a selection of supported digital wallets or accounts to bind their identity to.
2. Implement secure binding mechanisms to ensure user data privacy and security.
3. Provide clear instructions for binding, including any necessary steps or confirmations.
4. Display feedback on the success or failure of the binding process.

### Reveal

1. Offer users the option to reveal their identity within the Sovereign ecosystem.
2. Implement privacy controls to allow users to choose what information they share when revealing their identity.
3. Provide clear instructions for revealing an identity, including any necessary steps or confirmations.
4. Display feedback on the success or failure of the reveal process.

### Next Action

1. Direct users to the next appropriate action within the Sovereign platform based on their onboarding status and preferences.
2. Offer personalized recommendations for further engagement with the platform.
3. Provide clear instructions for completing the next action, including any necessary steps or confirmations.

### Optional Share

1. Allow users to share their identity with other trusted parties if desired.
2. Implement privacy controls to allow users to choose what information they share when sharing their identity.
3. Offer suggestions for potential recipients of the shared identity, such as friends or colleagues within the Sovereign ecosystem.
4. Provide clear instructions for sharing an identity, including any necessary steps or confirmations.

## Edge Cases

1. If a user encounters an error during the onboarding process, provide detailed error messages to help them troubleshoot and resolve the issue.
2. If a user's identity claim is rejected, offer guidance on how they can correct their information and reattempt the claim process.
3. If a user's binding attempt fails due to an issue with their chosen digital wallet or account, provide suggestions for alternative options and instructions for completing the binding process with those alternatives.
4. If a user encounters issues during the reveal process, offer guidance on how they can correct their privacy settings and reattempt the reveal process.
5. If a user's identity sharing attempt fails due to an issue with the recipient or privacy settings, provide suggestions for alternative recipients and instructions for completing the sharing process with those alternatives.
