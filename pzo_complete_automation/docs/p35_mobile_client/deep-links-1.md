# Deep Linking (Mobile Client v1)

## Overview

Deep linking allows the mobile application to open specific content within itself, directly from an external source such as another app or a web page. This feature enhances user experience by enabling seamless navigation between different platforms.

## Prerequisites

- A properly set up Mobile Client v1 application on both Android and iOS devices.
- Understanding of deep linking concept and its implementation for respective platforms (Android and iOS).

## Implementation Details

### Android

Deep linking on Android requires the following steps:

1. Add intent filters to the `AndroidManifest.xml` file.

```xml
<activity android:name=".MainActivity">
<intent-filter>
<action android:name="android.intent.action.VIEW" />
<category android:name="android.intent.category.DEFAULT" />
<category android:name="android.intent.category.BROWSABLE" />
<data android:scheme="app_scheme" />
</intent-filter>
</activity>
```
Replace `app_scheme` with a unique identifier for your application scheme (e.g., "myapp").

2. Register the scheme in AndroidManifest.xml:

```xml
<meta-data
android:name="android.app.shortcut.INTENT"
android:value="android.intent.action.VIEW" />

<meta-data
android:name="android.app.shortcut.INTENT_DATA"
android:resource="@xml/deep_link_shortcut" />
```

Create a file named `deep_link_shortcut.xml` in the `res/xml` directory with the following content:

```xml
<intent>
<action android:name="android.intent.action.VIEW" />
<category android:name="android.intent.category.DEFAULT" />
<data android:scheme="app_scheme" android:host="example_page" />
</intent>
```
Replace `app_scheme` and `example_page` with your scheme and desired page/content identifier, respectively.

3. If you want to support Android 8.0 (API level 26) or later, add `android:autoVerify="true"` to the intent filter:

```xml
<intent-filter android:autoVerify="true">
<!-- ... -->
</intent-filter>
```

### iOS

Deep linking on iOS requires the following steps:

1. Add Associated Domains in `Info.plist`.

```xml
<key>LSApplicationQueriesSchemes</key>
<array>
<string>app_scheme</string>
</array>

<key>associatedDomains</key>
<array>
<dict>
<key>APPLINK-ASSOCIATEDDOMAINS</key>
<array>
<string>applinks:</string>
<string>app_scheme</string>
</array>
</dict>
</array>
```
Replace `app_scheme` with your application scheme.

2. Implement app delegates' methods:

- In the AppDelegate, import necessary headers and conform to the `ASApplicationDelegate` protocol.

```swift
import AssetsLibrary
import MobileCoreServices
import UIKit

@main
class AppDelegate: UIResponder, UIApplicationDelegate, ASApplicationDelegate {
// ...
}
```

- Add the following methods to handle deep links:

```swift
func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) {
// Handle the deep link and perform the appropriate action.
}

func application(_ application: UIApplication, handleOpen url: URL) -> Bool {
// If the URL can be handled by your app, return true; otherwise, return false.
}
```

## Testing

Test deep links using various methods such as:

- Using a QR code generator to create a code that opens your application with a specific URL.
- Sharing a URL with the custom scheme from another app or website.

For more information and best practices, refer to the [official documentation](https://developer.apple.com/documentation/app_extension/deep_linking) for iOS deep linking and [Android documentation](https://developer.android.com/guide/components/intents-filters).
