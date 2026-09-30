const fs = require("fs");
const path = require("path");
const { withAppBuildGradle, withDangerousMod } = require("@expo/config-plugins");

/**
 * Config plugin: on every `expo prebuild`, copies the release keystore into
 * android/app/ and injects a `release` signingConfig into android/app/build.gradle,
 * pointing buildTypes.release at it.
 *
 * Reads keystore + passwords from credentials.json (project root).
 *
 * The plugin is intentionally a no-op when credentials.json is absent (e.g. EAS
 * builds, where the file is gitignored and never reaches the build server): EAS
 * resolves its own keystore and must not be interfered with.
 */

function readCredentials(projectRoot) {
  const file = path.join(projectRoot, "credentials.json");
  // No local credentials (e.g. EAS builds): return null and let EAS handle
  // its own keystore. Only local prebuild applies the release signingConfig.
  if (!fs.existsSync(file)) {
    return null;
  }
  const cred = JSON.parse(fs.readFileSync(file, "utf8"));
  const ks = cred.android && cred.android.keystore;
  if (!ks) {
    return null;
  }
  return ks;
}

// Copy keystore into android/app so gradle's `file('...')` resolves.
// withDangerousMod signature is (config, [platform, action]) — the action is
// the function that runs, not a mod name string.
function withKeystoreCopy(config) {
  return withDangerousMod(config, [
    "android",
    async (c) => {
      const ks = readCredentials(c.modRequest.projectRoot);
      if (!ks) return c; // no local credentials → nothing to copy
      const src = path.join(c.modRequest.projectRoot, ks.keystorePath);
      const destDir = path.join(c.modRequest.projectRoot, "android", "app");
      fs.mkdirSync(destDir, { recursive: true });
      fs.copyFileSync(src, path.join(destDir, path.basename(ks.keystorePath)));
      return c;
    },
  ]);
}

function withAndroidSigning(config) {
  // Dangerous mods run first, so the keystore file is in place before the
  // build.gradle that references it is written.
  config = withKeystoreCopy(config);

  return withAppBuildGradle(config, (c) => {
    const ks = readCredentials(c.modRequest.projectRoot);
    if (!ks) return c; // no local credentials → leave gradle as is
    const ksFile = path.basename(ks.keystorePath);

    const releaseBlock = `      release {
        storeFile file('${ksFile}')
        storePassword '${ks.keystorePassword}'
        keyAlias '${ks.keyAlias}'
        keyPassword '${ks.keyPassword}'
      }`;

    let contents = c.modResults.contents;

    // 1) Add a `release` block INSIDE signingConfigs (after the debug block's
    //    closing brace but before signingConfigs' own closing brace).
    if (!/release \{[\s\S]*?storeFile/.test(contents)) {
      contents = contents.replace(
        /(signingConfigs \{\s*debug \{[\s\S]*?\}\s*)/,
        (m) => m + "\n" + releaseBlock
      );
    }

    // 2) Point the release BUILD TYPE at signingConfigs.release (tolerant of
    //    the debug build type block that sits between buildTypes{ and release{).
    contents = contents.replace(
      /(buildTypes \s*\{[\s\S]*?release \s*\{[\s\S]*?)signingConfig signingConfigs\.debug/,
      (m, before) => before + "signingConfig signingConfigs.release"
    );

    // 3) Point the DEBUG build type at the same release signingConfig so ANY
    //    APK built locally (Android Studio Run button / assembleDebug) carries
    //    the trusted release certificate, not the throwaway debug.keystore.
    contents = contents.replace(
      /(buildTypes \s*\{\s*debug \s*\{[\s\S]*?)signingConfig signingConfigs\.debug/,
      (m, before) => before + "signingConfig signingConfigs.release"
    );

    c.modResults.contents = contents;
    return c;
  });
}

module.exports = withAndroidSigning;
