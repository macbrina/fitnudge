const { getSentryExpoConfig } = require("@sentry/react-native/metro");

const config = getSentryExpoConfig(__dirname);

// Add SVG support
config.resolver.assetExts.push("svg");
config.transformer.babelTransformerPath = require.resolve("react-native-svg-transformer");

// Allow .cjs imports
config.resolver.assetExts = config.resolver.assetExts.filter((ext) => ext !== "svg");
config.resolver.sourceExts = [...config.resolver.sourceExts, "svg", "cjs"];

// Fix for Supabase compatibility with Expo
// See: https://github.com/supabase/supabase-js/issues/1726
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
