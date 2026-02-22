# Deep Linking (v11) for Mobile Client

This document outlines the implementation of deep linking in version 11 of the mobile client.

## Overview

Deep linking allows users to navigate directly to specific sections or content within your application from external sources, such as emails, SMS messages, or other apps. This feature enhances user experience by providing a seamless transition between different applications and platforms.

## Implementation

### Prerequisites

- Ensure that the mobile client is updated to version 11 or later.
- Configure your app with a valid URL scheme for deep linking as per Apple's guidelines (for iOS) and Android's intent filters (for Android).

### Steps

1. Define the desired deep links in your app's configuration files, e.g., `Info.plist` for iOS or `AndroidManifest.xml` for Android.

2. Register the URL schemes with the corresponding platform's services:
- For iOS: Call the `canOpenURL(_:)` method on your application delegate to verify that the system can handle the deep link. Then, in your app's `AppDelegate`, implement the `application:continueUserActivity:` and `application:handleOpenURL:` methods.

- For Android: In your `AndroidManifest.xml`, declare your app's intent filters and set up an Activity to handle deep links. Override the `onNewIntent()` method in the corresponding activity class to handle deep linking events.

3. Within the handling functions (e.g., `application:continueUserActivity:` for iOS, or `onNewIntent()` for Android), extract the necessary data from the incoming intent/URL and navigate to the appropriate screen within your app using standard navigation methods.

4. Test deep linking by attempting to open the deep links from external sources like emails, SMS messages, or other apps.

### Best Practices

- Use consistent and descriptive URL schemes that accurately reflect the content being linked to.
- Implement fallbacks for cases where the user's device doesn't support deep linking or if your app is not installed on their device.
- Utilize platform-specific features, such as Universal Links (iOS) and Google's App Indexing API (Android), to improve search engine indexing and ensure that deep links are accessible from web searches as well.
