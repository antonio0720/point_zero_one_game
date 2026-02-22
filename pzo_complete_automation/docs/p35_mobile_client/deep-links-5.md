Title: Deep Links (Version 5) for Mobile Client Documentation

Deep Links (v5) for Mobile Client
==================================

Overview
--------

Deep linking allows users to navigate directly to specific content within your mobile app from external sources such as emails, SMS messages, or third-party applications. This document outlines the implementation of deep links (version 5) for our mobile client.

Prerequisites
-------------

Before diving into the details of deep linking implementation, ensure you have:

1. A functioning mobile app with the previous deep linking version integrated.
2. Familiarity with your platform's deep linking mechanisms (iOS - Universal Links, Android - Intents).
3. The latest version of our SDK integrated into your project.

Implementation
--------------

### Step 1: Update the SDK

Replace the previous SDK version in your project with the latest one that supports deep links (v5). This can be done by downloading the updated SDK package and integrating it into your project's build configuration.

### Step 2: Define Deep Link URL Scheme

Update or create a custom URL scheme for your app to handle incoming deep link requests. For example, if your app name is "MyApp," you might use `myapp://` as the base URL for your deep links.

#### iOS (Universal Links)

Add the following lines to your `Info.plist` file:

```xml
<key>LSApplicationQueriesSchemes</key>
<array>
<string>myapp</string>
</array>

<key>CFBundleURLTypes</key>
<array>
<dict>
<key>CFBundleURLName</key>
<sting>com.example.myapp</string>
<key>CFBundleURLSchemes</key>
<array>
<string>myapp</string>
</array>
</dict>
</array>
```

#### Android (Intents)

Update the `AndroidManifest.xml` file:

```xml
<intent-filter>
<action android:name="android.intent.action.VIEW" />
<category android:name="android.intent.category.DEFAULT" />
<category android:name="android.intent.category.BROWSABLE" />
<data android:scheme="myapp" />
</intent-filter>
```

### Step 3: Configure Deep Link URLs

Configure the deep link URLs for your app's specific content, such as screens, features, or activities. This can be done by setting up intent filters in Android and associated Associated Domains in iOS.

#### iOS (Associated Domains)

Add the following lines to your `Info.plist` file:

```xml
<key>com.apple.developer.associated-domains</key>
<dict>
<key>applinks</key>
<array>
<dict>
<key>apples-app-site-association</key>
<data>
{
"applinks": {
"apps": [],
"details": [
{
"appID": "TeamIdentifier.BundleIdentifier",
"paths": ["/*"]
}
]
}
}
</data>
</dict>
</array>
</dict>
```

Replace `TeamIdentifier.BundleIdentifier` with your app's Team ID and Bundle Identifier from the Apple Developer portal.

#### Android (Intents)

Configure deep link URLs by creating corresponding activities in your project's `AndroidManifest.xml` file, setting their intent filters accordingly.

### Step 4: Testing

Test the deep links implementation by attempting to open a deep linked URL using an external source, such as sending it via email or SMS, or by manually opening it in a browser that supports custom schemes. Verify that your app opens directly to the intended content.
