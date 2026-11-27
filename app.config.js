// Expo config. Config plugins are listed by hand: `expo install` cannot edit a
// dynamic config (spec section 2, known build facts).
// MHIZHA_BUILD is the build number (CI passes the run number), so the version
// code rises with every build.
const build = Number(process.env.MHIZHA_BUILD || 1);

module.exports = {
  expo: {
    name: 'Mhizha test',
    slug: 'mhizha',
    version: '1.0.0',
    orientation: 'portrait',
    // Test builds answer mhizha-test://self-test/... links from the emulator job.
    scheme: 'mhizha-test',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    backgroundColor: '#F6F7F7',
    android: {
      package: 'io.github.tamukamasvingise.mhizha.test',
      versionCode: build,
      allowBackup: false,
      adaptiveIcon: {
        backgroundColor: '#F6F7F7',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
      blockedPermissions: [
        'android.permission.READ_SMS',
        'android.permission.RECEIVE_SMS',
        'android.permission.SEND_SMS',
        'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE',
        'android.permission.BIND_ACCESSIBILITY_SERVICE',
        // expo-contacts asks for both; Mhizha only reads one picked contact.
        'android.permission.WRITE_CONTACTS',
      ],
    },
    extra: { build, selfTest: true },
    plugins: ['expo-sqlite', 'expo-contacts', 'expo-sharing', ['expo-build-properties', { android: { minSdkVersion: 29 } }]],
  },
};
