const { withAndroidStyles } = require("@expo/config-plugins");

/**
 * Config plugin: when the splash is configured as a solid color (no image),
 * removes the Android 12+ `windowSplashScreenAnimatedIcon` / behavior items
 * that would otherwise reference the (now absent) splashscreen_logo drawable.
 * Keeps the native splash as a clean solid background until React mounts.
 *
 * Place AFTER `expo-splash-screen` in the plugins array so it runs on the
 * styles.xml that the splash plugin generated.
 */
module.exports = function withSolidSplash(config) {
  return withAndroidStyles(config, (c) => {
    const style = c.modResults.resources.style?.find?.(
      (s) => s.$.name === "Theme.App.SplashScreen"
    );
    if (style?.item) {
      style.item = style.item.filter(
        (i) =>
          i.$.name !== "windowSplashScreenAnimatedIcon" &&
          i.$.name !== "android:windowSplashScreenBehavior"
      );
    }
    return c;
  });
};
