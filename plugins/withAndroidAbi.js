const { withAppBuildGradle } = require("@expo/config-plugins");

/**
 * Config plugin: restricts the APK's native ABIs to arm64-v8a + armeabi-v7a.
 * Drops x86 / x86_64 (only needed for emulators), which meaningfully shrinks
 * the APK on EAS by excluding those native .so libraries.
 *
 * Every real device in the fleet (Redmi, etc.) is arm64 or v7a.
 */
module.exports = function withAndroidAbi(config) {
  return withAppBuildGradle(config, (c) => {
    let contents = c.modResults.contents;
    if (!/abiFilters/.test(contents)) {
      contents = contents.replace(
        /(applicationId\s+'[^']+')/,
        "$1\n" +
          "        ndk {\n" +
          "            abiFilters 'arm64-v8a', 'armeabi-v7a'\n" +
          "        }"
      );
    }
    c.modResults.contents = contents;
    return c;
  });
};