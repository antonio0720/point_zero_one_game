Deep Links (Version 12) for Mobile Client
==========================================

Overview
--------

Deep links allow users to navigate directly to specific screens within the mobile application from external sources such as email, SMS, or web pages. This document outlines the implementation details of deep linking in version 12 of our mobile client.

Prerequisites
-------------

- iOS and Android development environment set up
- Understanding of URL schemes and intents
- Familiarity with your project's navigation structure

Deep Link Implementation
-------------------------

### iOS

#### 1. Registering the URL Scheme

To handle deep links on iOS, you need to register a custom URL scheme for your application in the `Info.plist` file:

```xml
<key>CFBundleURLTypes</key>
<array>
<dict>
<key>CFBundleURLSchemes</key>
<array>
<string>myapp</string>
</array>
</dict>
</array>
```
Replace `myapp` with the desired URL scheme for your application.

#### 2. Implementing AppDelegate Methods

Add the following methods to your `AppDelegate.swift`:

```swift
func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) {
if userActivity.activityType == NSUserActivityTypeBrowsingWeb {
handleDeepLink(url: userActivity.webpageURL!)
}
}

func application(_ application: UIApplication, open url: URL, sourceApplication: String?, annotation: Any) -> Bool {
if let deepLink = parseDeepLink(url: url) {
handleDeepLink(deepLink)
return true
}
return false
}
```

Implement the `handleDeepLink()` method to process the deep link and navigate accordingly.

#### 3. Parsing Deep Links

Create a function to parse the incoming deep links:

```swift
func parseDeepLink(url: URL) -> DeepLink? {
// Implement parsing logic here
}
```

### Android

#### 1. Adding Intent-Filter in Manifest.xml

To handle deep links on Android, you need to add an intent-filter for your desired URL scheme to the `AndroidManifest.xml` file:

```xml
<activity android:name=".MainActivity">
<intent-filter>
<action android:name="android.intent.action.VIEW" />
<category android:name="android.intent.category.DEFAULT" />
<category android:name="android.intent.category.BROWSABLE" />
<!-- Replace "myapp" with your desired URL scheme -->
<data android:scheme="myapp" />
</intent-filter>
</activity>
```

#### 2. Implementing MainActivity Methods

Add the following methods to your `MainActivity.java`:

```java
@Override
protected void onNewIntent(Intent intent) {
handleDeepLink(intent);
}

public static Intent newIntentWithDeepLink(Context context, Uri deepLink) {
Intent intent = new Intent(context, MainActivity.class);
intent.setData(deepLink);
return intent;
}
```

Implement the `handleDeepLink()` method to process the deep link and navigate accordingly.

#### 3. Parsing Deep Links

Create a function to parse the incoming deep links:

```java
Uri deepLink = getIntent().getData();
// Implement parsing logic here
```

Testing Deep Links
-------------------

To test your deep link implementation, create a URL with the registered URL scheme and open it on an iOS device or Android device using a web browser. The app should open and navigate to the intended screen.
