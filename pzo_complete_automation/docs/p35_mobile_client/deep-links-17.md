# Deep Links (v1.7) for Mobile Client Documentation

## Overview

This document outlines the Deep Links (v1.7) implementation for our mobile client. Deep links allow users to navigate directly to specific sections or content within the app using external URLs, improving user experience and ease of access.

### Prerequisites

- A properly configured application with Android's App Links and iOS Universal Links support.
- Enabled `android:autoVerify` and `com.google.android.gms.VERIFIED_APPLICATION` in the AndroidManifest.xml file.
- Properly set up Associated Domains in Xcode for iOS.

## Deep Link Handling

Deep links can be structured as follows:

```
yourapp://[path]
```

### Supported Paths

#### Home Screen (Default)

```
yourapp://
```

Navigates users to the home screen of the app.

#### Specific Content

```
yourapp://content/[id]
```

Navigates users directly to a specific piece of content identified by its unique id.

### Handling Deep Links

Deep links are automatically handled by the mobile client, and the appropriate screen is displayed based on the path provided in the URL.

## Customizing Deep Link Behavior

If custom behavior for deep link handling is required, it can be implemented using the following approaches:

### Android

On Android, you can override the `onNewIntent` method in your activity to handle incoming deep links.

```kotlin
override fun onNewIntent(intent: Intent) {
super.onNewIntent(intent)
// Handle the incoming deep link here
}
```

### iOS

On iOS, you can use the `application(_:continue:restorationHandler:)` method in your application delegate to handle incoming deep links.

```swift
func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
// Handle the incoming deep link here
return true
}
```

## Testing Deep Links

To test deep links, you can use URL schemes on your mobile device or a simulator. For example:

- Android: `yourapp://`
- iOS: `yourapp://` (for testing Universal Links) or `intent://#Intent;package=com.example;scheme=yourapp;S.ACTIVITY=com.example.MainActivity;end` (for testing App Links)

## Troubleshooting

If you encounter any issues with deep link handling, ensure that your app's configuration for both Android and iOS is properly set up, and that the URL schemes are correctly registered in your project.

---

For further information, please consult the respective documentation for Android App Links (<https://developers.google.com/app-indexing/>) and iOS Universal Links (<https://developer.apple.com/documentation/uikitconceptual/interacting_with_apps_using_urls>).
