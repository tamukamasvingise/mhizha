// PROTOTYPE, throwaway: Install and update proof.
// PROOF_VERSION (1, 2, 3) sets the version code; build.sh sets it per build.
const v = Number(process.env.PROOF_VERSION || '1');

module.exports = {
  expo: {
    name: 'Mhizha proof',
    slug: 'mhizha-install-update-proof',
    version: `0.0.${v}`,
    orientation: 'portrait',
    android: {
      package: 'io.github.tamukamasvingise.mhizha.test',
      versionCode: v,
    },
    plugins: [['expo-build-properties', { android: { minSdkVersion: 29 } }]],
  },
};
