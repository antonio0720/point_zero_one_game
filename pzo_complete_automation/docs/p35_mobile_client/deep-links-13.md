```markdown
# Deep Linking (Version 1.3) for Mobile Client

This document outlines the implementation of Deep Linking in version 1.3 of the Mobile Client.

## Overview

Deep linking allows users to navigate directly to specific content within an application, as opposed to just launching the app. This feature enhances user experience by providing a seamless transition from external sources such as emails, messages, or web links.

## Prerequisites

- A properly configured Mobile Client application
- Implemented Universal Links (iOS) or App Links (Android) for your project

## Deep Linking Components

### Intent Filters (Android)

Intent filters are used to define the deep link structure on Android. They consist of an action, data, category, and MIME type.

```xml
<activity android:name=".MainActivity">
<intent-filter>
<action android:name="android.intent.action.VIEW" />
<category android:name="android.intent.category.DEFAULT" />
<category android:name="android.intent.category.BROWSABLE" />
<data android:scheme="your_app_id" />
</intent-filter>
</activity>
```

### Associated Domains (iOS)

Associated domains allow you to define custom URL schemes for your iOS app. You can register associated domains in the Xcode project under the "Signing & Capabilities" tab.

```xml
<key>com.apple.developer.associated-domains</key>
<array>
<dict>
<key>applinks</key>
<array>
<string>applink://your_app_id/*</string>
</array>
</dict>
</array>
```

## Deep Link Handling

When a deep link is clicked, the mobile client will open and navigate to the associated content. It's essential to implement proper deep link handling in your app to handle these links effectively.

### Android

In your MainActivity or other relevant activity, you can override the onNewIntent method to handle incoming deep links:

```java
@Override
public void onNewIntent(Intent intent) {
super.onNewIntent(intent);
// Handle the deep link here
}
```

### iOS

In your AppDelegate, you can implement application:continueUserActivity:restorationHandler: to handle incoming deep links in iOS:

```swift
func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
// Handle the deep link here
return true
}
```

## Testing Deep Links

To test your deep links, you can use various tools such as Bitly, Branch.io, or other URL shortening services to create custom URLs for testing purposes. You can also manually test deep links on Android using intent actions and on iOS by pasting the deep link in Safari.
