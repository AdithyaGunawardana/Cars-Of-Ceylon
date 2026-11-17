// Extends app.json. Plain-HTTP API access ("cleartext traffic") is needed only for local development builds, where the
// API runs on a PC's LAN address. It is opt-in per EAS profile (see eas.json) and never enabled for preview/production.
module.exports = ({ config }) => {
  const plugins = [...(config.plugins ?? [])];

  if (process.env.EXPO_PUBLIC_ALLOW_CLEARTEXT === "1") {
    plugins.push(["expo-build-properties", { android: { usesCleartextTraffic: true } }]);
  }

  return { ...config, plugins };
};
