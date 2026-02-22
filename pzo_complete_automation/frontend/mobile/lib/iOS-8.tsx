```objective-c
#import <UIKit/UIKit.h>
#import "RCTBridge.h"
#import "RCTRootView.h"
#import "AppDelegate.h"

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions {
self.window = [[UIWindow alloc] initWithFrame:[UIScreen mainScreen].bounds];
RCTBridge *bridge = [[RCTBridge alloc] initWithDelegate:self launchOptions:launchOptions];
RCTRootView *rootView = [[RCTRootView alloc] initWithBridge:bridge launchOptions:launchOptions];
self.window.rootViewController = rootView;
[self.window makeKeyAndVisible];
return YES;
}
```
