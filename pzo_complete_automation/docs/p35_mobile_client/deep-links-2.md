Deep Links (Version 2) for Mobile Client
=========================================

Overview
--------

Deep Linking is a powerful feature that allows apps to link directly to specific content within other apps, enabling seamless user experiences across different platforms. This document outlines the implementation of Deep Links (Version 2) in our mobile client.

Prerequisites
-------------

Before diving into the details, ensure you have:

1. A comprehensive understanding of [Deep Links (Version 1)](../deep-links-1.md).
2. Familiarity with [Navigation and Routing](../../navigation/index.md) in our mobile client.
3. Implemented the necessary Deep Linking setup for your platform according to its specific guidelines:
- [iOS Deep Links Setup](../ios/deep-links-setup.md)
- [Android Deep Links Setup](../android/deep-links-setup.md)

Deep Link Structure
--------------------

To create a deep link for version 2, follow this structure:

```
<scheme>://<app-id>/<path>?<parameters>=<values>
```

Replace the following placeholders with the appropriate values:

- `<scheme>`: The custom URL scheme defined in your app's configuration (e.g., `myapp`).
- `<app-id>`: Your app's identifier or bundle ID.
- `<path>`: A specific route or screen within your app, such as `profile`, `settings`, or `login`.
- `<parameters>`: Optional query parameters to provide additional context for the target route (e.g., `user_id=123`).
- `<values>`: The corresponding values for the specified parameters.

Deep Link Handling
-------------------

When a deep link is tapped, our mobile client will handle it by following these steps:

1. Determine the intent of the deep link based on its structure.
2. Navigate to the appropriate route or screen using [Navigation and Routing](../../navigation/index.md).
3. If necessary, retrieve and pass any query parameters to the target route for further processing.
4. Update the application state if required by the new route (e.g., update the navigation bar or display specific content).

Example
-------

Let's consider a deep link for opening the user profile screen with user ID 123:

```
myapp://com.example.app/profile?user_id=123
```

When this link is tapped, our mobile client will navigate to the `profile` route and pass the `user_id` parameter with value 123. The target route can then use this information to load the correct user profile data.

Conclusion
----------

Deep Links (Version 2) enable you to create a more integrated and seamless user experience by linking directly to specific content within your mobile app from external sources like emails, messages, or web browsers. Implement these deep links in your project using the guidelines provided above.
