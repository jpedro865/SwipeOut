// Release builds get their version from CI (semantic-release); unset env keeps app.json's values.
module.exports = ({ config }) => {
  const { APP_VERSION, BUILD_NUMBER } = process.env
  return {
    ...config,
    version: APP_VERSION || config.version,
    ios: { ...config.ios, buildNumber: BUILD_NUMBER || config.ios?.buildNumber },
    android: { ...config.android, versionCode: BUILD_NUMBER ? Number(BUILD_NUMBER) : config.android?.versionCode },
  }
}
