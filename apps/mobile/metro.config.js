const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Add SVG support
config.resolver.assetExts.push("svg");
config.transformer.babelTransformerPath = require.resolve(
  "react-native-svg-transformer"
);

// Allow .cjs imports
config.resolver.sourceExts.push("cjs");

module.exports = config;
