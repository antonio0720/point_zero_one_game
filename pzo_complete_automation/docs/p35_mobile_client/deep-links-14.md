# Deep Linking (Version 1.4) for Mobile Client

## Overview

Deep linking is a practice that allows an application to be opened to a specific section or content within the app, using a URL from outside the app. This feature enhances user experience by providing seamless navigation and easy access to specific sections of the app.

In this version (1.4), we have made several improvements and additions to our deep linking functionality for the mobile client.

## Supported Platforms

- iOS: This update supports deep linking on all iOS devices running iOS 9.0 or later, with universal links implementation.
- Android: Deep linking continues to work smoothly on Android devices running API Level 21 (Lollipop) and higher.

## New Features

### Dynamic Links for Android

Introducing dynamic links for Android! This feature allows users who do not have the app installed to be directed to the Play Store when clicking a deep link, offering a more seamless experience for new users.

### Universal Links Improvements

Improved universal links support on iOS provides better handling of fallback URLs and enhanced error reporting.

## Enhancements

- Improved deep link detection: Our system now offers faster and more reliable deep link detection across both iOS and Android platforms.
- Error handling updates: We have refined our error handling to provide clearer, more helpful error messages when issues arise during the deep linking process.

## Deprecations

In this release, we are deprecating support for older platform versions as follows:

- iOS 8 and earlier will no longer be supported for universal links.
- Android API Level 20 (KitKat) and lower will no longer support deep linking.

## Migration Guide

For existing users moving to this version, please review our migration guide to ensure a smooth transition: [Migration Guide for Deep Linking Version 1.4](docs/p35_mobile_client/deep-links-migration-v1.4.md)

## Getting Started

To get started with deep linking in your mobile app, follow the steps outlined in our [Deep Linking Guide for Mobile Clients](docs/p35_mobile_client/deep-links-guide.md).

If you encounter any issues or have questions about this release, please reach out to our support team at [support@example.com](mailto:support@example.com). We're here to help!
