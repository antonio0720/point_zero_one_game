# Deep Links (v8) for Mobile Client

This document outlines the version 8 implementation of deep linking in our mobile application.

## Overview

Deep linking allows users to open specific screens or features within the app using a custom URL scheme, rather than navigating through the main interface. This feature enhances user experience by providing direct access to specific content and improving engagement.

## Supported Platforms

Deep links are supported on both iOS (iOS 9.0+) and Android (API level 21+) platforms.

## Implementation Details

### iOS

To enable deep linking in the iOS app, follow these steps:

1. Add the following lines to your `Info.plist` file:

```xml
<key>CFBundleURLTypes</key>
<array>
<dict>
<key>CFBundleURLSchemes</key>
<array>
<string>your_custom_url_scheme</string>
</array>
</dict>
</array>
```

Replace `your_custom_url_scheme` with a unique URL scheme for your app.

2. Register the URL scheme in your AppDelegate:

```swift
func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
// ...

if #available(iOS 9.0, *) {
let urlTypes: [UTPApplicationOpenURLOptionsKey: Any] = [:]
application.continueUserActivity(userActivity, withOptions: urlTypes)
}

// ...
}

func application(_ application: UIApplication, handleOpen url: URL) -> Bool {
let storyboard = UIStoryboard(name: "Main", bundle: nil)
if let navigationController = storyboard.instantiateViewController(withIdentifier: "MainNavigator") as? UINavigationController,
let targetVC = url.pathComponents.last?.components(separatedBy: "/").last?.capitalized as? String,
let viewController = storyboard.instantiateViewController(withIdentifier: targetVC) {
navigationController.pushViewController(viewController, animated: true)
}

return true
}
```

### Android

To enable deep linking in the Android app, follow these steps:

1. Add the following lines to your `AndroidManifest.xml` file inside the `<application>` tag:

```xml
<intent-filter>
<action android:name="android.intent.action.VIEW" />
<category android:name="android.intent.category.DEFAULT" />
<category android:name="android.intent.category.BROWSABLE" />
<data
android:host="your_custom_url_scheme"
android:path="/path/*"
android:scheme="http" />
</intent-filter>
```

Replace `your_custom_url_scheme` with a unique URL scheme for your app.

2. Create an intent filter to handle deep links:

```java
public class MainActivity extends AppCompatActivity {
// ...

@Override
protected void onCreate(Bundle savedInstanceState) {
super.onCreate(savedInstanceState);
// ...

if (getIntent().getDataString() != null) {
String path = getIntent().getDataString().substring(getIntent().getDataString().lastIndexOf('/') + 1);
Intent intent = new Intent(this, SpecificActivity.class);
intent.putExtra("path", path);
startActivity(intent);
}
}
}
```
