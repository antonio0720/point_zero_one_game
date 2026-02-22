```markdown
# Deep Linking (Version 10) for Mobile Client

The Mobile Client v10 supports deep linking, enabling seamless navigation to specific screens within the app from external sources like email, SMS, or other apps. This feature can significantly improve user experience and engagement.

## Prerequisites

- Ensure that your mobile application is integrated with a linking library such as `react-native-deep-linking` for React Native or `Flutter Deep Linking` for Flutter applications.
- Install necessary packages according to the platform (iOS, Android) and configure the appropriate settings in your project.

## Configuring Deep Links

### iOS

1. In `Info.plist`, add the following key with its associated URL schema:

```xml
<key>LSApplicationQueriesSchemes</key>
<array>
<string>myappscheme</string>
</array>

<key>CFBundleURLTypes</key>
<array>
<dict>
<key>CFBundleURLSchemes</key>
<array>
<string>myappscheme</string>
</array>
</dict>
</array>
```
Replace `myappscheme` with the desired URL scheme for your app.

2. Modify the `AppDelegate.m` file to handle incoming deep links:

```objc
#import <MobileCoreServices/UTType.h>

...
- (BOOL)application:(UIApplication *)application continueUserActivity:(NSUserActivity *)userActivity restorationHandler:(void (^)(NSArray * _Nullable))restorationHandler {
if ([userActivity.activityType isEqualToString:NSUserActivityTypeBrowsingWeb]) {
// Handle deep link here and navigate to the appropriate screen
NSURL *url = userActivity.webpageURL;
...
}
return YES;
}
...
```

### Android

1. In `AndroidManifest.xml`, add the desired URL scheme for your app:

```xml
<intent-filter>
<action android:name="android.intent.action.VIEW" />
<category android:name="android.intent.category.DEFAULT" />
<category android:name="android.intent.category.BROWSABLE" />
<data android:scheme="myappscheme" />
</intent-filter>
```
Replace `myappscheme` with the desired URL scheme for your app.

2. In your main activity (e.g., `MainActivity.java`), override the `onNewIntent()` method to handle incoming deep links:

```java
@Override
public void onNewIntent() {
super.onNewIntent();

// Handle deep link here and navigate to the appropriate screen
Uri uri = getIntent().getData();
...
}
```

## Creating Deep Links

To create deep links for sharing or sending via email/SMS, construct a URL with your app's scheme followed by any additional parameters:

```
myappscheme://[path]?[key1]=[value1]&[key2]=[value2]...
```

Replace `[path]`, `[key1]`, and `[value1]` with the appropriate values for your app's screens, parameters, and data.

### React Native Example

To open a deep link in React Native:

```javascript
import { Linking } from 'react-native';

Linking.openURL('myappscheme://path');
```

### Flutter Example

To open a deep link in Flutter:

```dart
import 'package:flutter/services.dart';

await launchURL('myappscheme://path');
```
