# Deep Linking in Mobile Client (v15)

## Overview

Deep linking is a powerful feature that allows for the seamless navigation between different apps, websites, or even specific sections within an app using URLs. This document outlines the deep-linking implementation in our Mobile Client version 15.

## Supported Platforms

Our Mobile Client v15 supports deep linking on both Android and iOS platforms.

## Deep Link Structure

The basic structure of a deep link for our Mobile Client v15 is as follows:

```
<scheme>://<app-id>/<path>?params
```

Replace `<scheme>` with the custom URL scheme defined for your application, `<app-id>` with your app's unique identifier, and `<path>` with the specific destination or action within the app. The `params` part is optional and can be used to pass additional data to the app.

## Android Specifics

### Intent Filters

To handle deep links on Android, you need to define intent filters in your AndroidManifest.xml file:

```xml
<intent-filter>
<action android:name="android.intent.action.VIEW" />
<category android:name="android.intent.category.DEFAULT" />
<category android:name="android.intent.category.BROWSABLE" />
<data android:scheme="<your-custom-url-scheme>" />
</intent-filter>
```

Replace `<your-custom-url-scheme>` with the custom URL scheme defined for your application.

### Manifest Receiver

To receive deep links on Android, you can create a BroadcastReceiver:

```java
public class DeepLinkReceiver extends BroadcastReceiver {
@Override
public void onReceive(Context context, Intent intent) {
// Handle the deep link here
}
}
```

Remember to register this receiver in your AndroidManifest.xml:

```xml
<receiver android:name=".DeepLinkReceiver" />
```

## iOS Specifics

### App Delegate

To handle deep links on iOS, you need to implement the `application:continueUserActivity:` method in your AppDelegate.swift:

```swift
func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
// Handle the deep link here
}
```

### Associated Domains

To use custom URL schemes on iOS, you need to enable associated domains in your Info.plist file:

```xml
<key>LSApplicationQueriesSchemes</key>
<array>
<string>your-custom-url-scheme</string>
</array>

<key>com.apple.developer.associated-domains</key>
<dict>
<key>applinks</key>
<array>
<dict>
<key>teamID</key>
<string>YOUR_TEAM_ID</string>
<key>domainName</key>
<string>YOUR_BUNDLE_IDENTIFIER.com</string>
<key>platforms</key>
<array>
<string>ios</string>
</array>
</dict>
</array>
</dict>
```

Replace `YOUR_TEAM_ID` with your Apple Developer Team ID and `YOUR_BUNDLE_IDENTIFIER.com` with your app's bundle identifier (e.g., com.example.myapp.com).

## Examples

### Opening a specific screen

```
<your-custom-url-scheme>://screens/home
```

### Passing additional data

```
<your-custom-url-scheme>://data?name=John&age=30
```
