// Extends app.json. CI passes BUILD_NUMBER so every APK has a higher versionCode
// and installs over the previous one without uninstalling (your data is kept).
module.exports = ({ config }) => {
  const build = Number(process.env.BUILD_NUMBER || 1);
  return {
    ...config,
    version: `1.0.${build}`,
    android: { ...config.android, versionCode: build },
  };
};
