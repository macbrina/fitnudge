module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      [
        "module-resolver",
        {
          root: ["./src"],
          extensions: [".ios.js", ".android.js", ".js", ".ts", ".tsx", ".json"],
          alias: {
            "@ui": "../../packages/ui/src",
            "@assets": "../../packages/assets/src",
            "local:next-up-live-activity": "./modules/next-up-live-activity"
          }
        }
      ],
      "react-native-reanimated/plugin"
    ]
  };
};
