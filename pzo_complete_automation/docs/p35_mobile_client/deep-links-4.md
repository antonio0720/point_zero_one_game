```markdown
# Deep Linking (Version 4) - Mobile Client Documentation

## Overview

This document provides a comprehensive guide on implementing version 4 of deep linking within the mobile client application.

## Prerequisites

- A properly set up mobile development environment
- Understanding of Android and iOS deep linking mechanisms
- Familiarity with the mobile client SDK

## Deep Linking Setup (Android)

1. Include the `android_deep_links` module in your app's build.gradle file:

```groovy
dependencies {
implementation project(':android_deep_links')
}
```

2. Add an intent filter to your app's main manifest file (AndroidManifest.xml):

```xml
<intent-filter>
<action android:name="android.intent.action.VIEW" />
<category android:name="android.intent.category.DEFAULT" />
<category android:name="android.intent.category.BROWSABLE" />
<!-- Replace {your_package} with your application package name -->
<data android:scheme="{your_scheme}" />
</intent-filter>
```

Replace `{your_scheme}` with a unique URI scheme for your app.

3. Register the URI scheme in your AndroidManifest.xml:

```xml
<activity android:name=".MainActivity">
<meta-data
android:name="android.intent.extra.PREVIOUS_INTENT"
android:value="android.intent.extra.TEXT" />
</activity>
```

## Deep Linking Setup (iOS)

1. In your app's Info.plist file, add the URL types and the associated scheme for deep linking:

```xml
<key>CFBundleURLTypes</key>
<array>
<dict>
<key>CFBundleURLSchemes</key>
<!-- Replace {your_scheme} with your application's scheme -->
<array><string>{your_scheme}</string></array>
</dict>
</array>
```

2. Implement the `application:continueUserActivity:` method in your app delegate to handle deep linking:

```swift
func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
// Handle the deep link and return true if handled correctly.
}
```

## Handling Deep Links in Your App

1. In your main activity or app delegate, extract the parameters from the intent or user activity:

Android:

```kotlin
val data: Uri? = intent.data
if (data != null) {
val params = data.getQueryParameters() // Custom function to get query parameters
}
```

iOS:

```swift
let userActivity = application.continuingUserActivity as? NSUserActivity
guard let incomingURL = userActivity?.webpageURL else { return false }
let params = incomingURL.queryParameters // Custom function to get query parameters
```

2. Use the extracted parameters to navigate to the appropriate screens within your app, process transactions, or perform any other desired actions.
