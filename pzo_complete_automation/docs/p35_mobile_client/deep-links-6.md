# Deep Linking (Version 6) for Mobile Client

In this document, we will discuss the implementation and usage of deep linking (version 6) for our mobile application client.

## Overview
Deep linking is a method that allows an application to receive external intent from a URL. This feature enables users to navigate directly to specific screens within the app by clicking on links, improving user experience and engagement.

## Prerequisites
Before diving into deep-link implementation, make sure you have the following:

1. A properly set up development environment for your mobile application project.
2. Understanding of Android's Intents and how they work.
3. Familiarity with URL schemes and their use in mobile applications.

## Deep Link Implementation Steps

### Step 1: Registering App with Firebase Dynamic Links
First, you need to create a new Firebase project if you haven't already and register your app for deep linking. Follow the [official Firebase documentation](https://firebase.google.com/docs/dynamic-links/android) to complete the setup process.

### Step 2: Add Firebase to Your Project
In order to use Firebase Dynamic Links, you'll need to add the Firebase SDK to your project. You can find the steps for adding the Firebase SDK in the [Android documentation](https://firebase.google.com/docs/android/setup).

### Step 3: Configure Manifest File
Add the following meta-data to your AndroidManifest.xml file:

```xml
<meta-data
android:name="com.google.firebase.apps"
android:value="[YOUR_FIREBASE_APP_ID]"/>
<activity android:name="com.example.yourapp.MainActivity">
<intent-filter>
<action android:name="android.intent.action.VIEW" />
<category android:name="android.intent.category.DEFAULT" />
<category android:name="android.intent.category.BROWSABLE" />
<!-- The scheme that your app will handle -->
<data
android:scheme="[YOUR_APP_SCHEME]"
android:host="*" />
</intent-filter>
</activity>
```

Replace `[YOUR_FIREBASE_APP_ID]` with the Firebase App ID, and replace `[YOUR_APP_SCHEME]` with a unique scheme for your app (e.g., `myapp://`).

### Step 4: Create Deep Link Handler
Create or update the `MainActivity.java` file to handle deep links:

```java
import com.google.firebase.dynamiclinks.DynamicLink;
import com.google.firebase.dynamiclinks.FirebaseDynamicLinks;

//...

@Override
protected void onCreate(Bundle savedInstanceState) {
super.onCreate(savedInstanceState);
setContentView(R.layout.activity_main);

// ...

FirebaseApp.initializeApp(this);
FirebaseDynamicLinks.getInstance().getDynamicLink(getIntent())
.addOnSuccessListener(this, new OnSuccessListener<DynamicLink>() {
@Override
public void onSuccess(DynamicLink dynamicLink) {
// The deep link was successfully parsed and is available for use.
}
})
.addOnFailureListener(this, new OnFailureListener() {
@Override
public void onFailure(@NonNull Exception exception) {
// Handle the error.
}
});
}
```

### Step 5: Create Deep Links for Specific Screens
Create deep links for specific screens in your app by calling the Firebase Dynamic Links `buildShortDynamicLink()` method and setting the target screen's intent as the destination. You can then share these links with users or display them on web platforms.

## Testing Deep Links
To test deep linking, you can:

1. Build your app and install it on an Android device.
2. Generate a dynamic link for a specific screen using the Firebase console or SDK.
3. Click on the generated deep link from another app (such as Chrome) or open it directly in the browser on your phone. The app should now navigate to the specified screen.
