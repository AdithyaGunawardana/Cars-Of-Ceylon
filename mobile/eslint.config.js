// ESLint 9 flat config using Expo's recommended rules (React, React Hooks, import, TypeScript for React Native).
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", ".expo/*", "node_modules/*"],
  },
]);
