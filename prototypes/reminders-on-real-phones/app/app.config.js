// PROTOTYPE, throwaway: Reminders on real phones.
// Its own package name, so it installs beside the Install and update proof app.
module.exports = {
  expo: {
    name: 'Mhizha reminders test',
    slug: 'mhizha-reminders-test',
    version: '0.0.1',
    orientation: 'portrait',
    android: {
      package: 'io.github.tamukamasvingise.mhizha.test.reminders',
      versionCode: 1,
    },
    plugins: ['expo-notifications', ['expo-build-properties', { android: { minSdkVersion: 29 } }]],
  },
};
