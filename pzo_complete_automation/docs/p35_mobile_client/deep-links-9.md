# Deep Linking (v9) for Mobile Client

The Mobile Client supports deep linking in version 9, enabling seamless navigation from external sources to specific screens within the application. This feature allows users to open your app with a custom URL scheme and directly access a specific screen or functionality.

## Table of Contents

1. [Setting Up Deep Linking](#setting-up-deep-linking)
2. [Custom URL Scheme](#custom-url-scheme)
3. [Handling Deep Linked Intents](#handling-deep-linked-intents)
4. [Example: Navigating to a Specific Screen](#example-navigating-to-a-specific-screen)
5. [Fallback and Default Behavior](#fallback-and-default-behavior)
6. [Testing Deep Links](#testing-deep-links)

## Setting Up Deep Linking <a name="setting-up-deep-linking"></a>

To set up deep linking, you need to declare your custom URL scheme in the AndroidManifest.xml file of your app and update the App Delegate (AppDelegate.swift for iOS or MainApplication.java for Android) to handle these incoming intents.

### iOS:

1. In Xcode, open your project's Info.plist file.
2. Add a new key named `CFBundleURLTypes` and set its value as an array containing a dictionary with two keys: `CFBundleURLSchemes` and `LSApplicationQueriesSchemes`. The former should contain your custom URL scheme, while the latter is optional and can be used to handle universal links.
3. Save your changes and rebuild the project.

### Android:

1. Open the AndroidManifest.xml file in your project's main module (usually named `app`).
2. Add a new element `<intent-filter>` inside the `<activity>` for your app's launcher activity.
3. Set the `android:autoVerify="true"` attribute on the intent filter to enable deep linking.
4. Declare your custom URL scheme as the data attribute of the intent filter, using the `scheme` property.
5. Save your changes and sync the Gradle project.

## Custom URL Scheme <a name="custom-url-scheme"></a>

Choose a unique, memorable, and easy-to-type custom URL scheme for your app. For example: `myapp://`. This scheme will be used to create deep links that can direct users to specific screens or functionality within your app.

## Handling Deep Linked Intents <a name="handling-deep-linked-intents"></a>

In the App Delegate, you'll need to handle incoming intents with the declared custom URL scheme. This involves creating a function that examines the intent and performs the appropriate navigation based on the deep link.

### iOS:

1. In AppDelegate.swift, create a function like `application(_:continue:restorationID:)` to handle deep-linked intents when your app is opened from an external source.
2. Inside this function, check if the intent contains a URL with your custom scheme. If it does, extract the parameters and perform the necessary navigation or actions.
3. Call `super.application(_:continue:restorationID:)` to let the system handle any other intents.

### Android:

1. In MainApplication.java, create an override for the `onNewIntent` method in the base application class (usually AppCompatApplication).
2. Inside this method, check if the intent contains a URL with your custom scheme. If it does, extract the parameters and perform the necessary navigation or actions.
3. Call `super.onNewIntent(intent)` to let the system handle any other intents.

## Example: Navigating to a Specific Screen <a name="example-navigating-to-a-specific-screen"></a>

To navigate to a specific screen using deep linking, extract the parameters from the URL and use them to initialize or configure the destination screen as needed. For example:

```swift
let url = intent.url
if let itemID = url?.lastPathComponent {
// Navigate to details screen for the specified item with ID 'itemID'
}
```

## Fallback and Default Behavior <a name="fallback-and-default-behavior"></a>

When a deep link is not handled correctly, users should be directed to a fallback screen or provided with an error message. Consider implementing default behavior that catches any unexpected deep links and redirects users to a suitable destination.

## Testing Deep Links <a name="testing-deep-links"></a>

To test your deep link implementation, you can create a custom URL containing your app's custom scheme and launch it from various sources such as Safari (iOS) or Chrome (Android). Additionally, testing tools like Bitrise, AppCenter, or Fastlane can help automate the process of generating and testing deep links.
