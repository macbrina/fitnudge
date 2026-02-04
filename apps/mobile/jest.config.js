module.exports = {
  preset: "jest-expo/node",
  testMatch: ["**/__tests__/**/*.test.[jt]s?(x)"],
  transformIgnorePatterns: [
    "node_modules/(?!(jest-expo|expo-modules-core|(jest-)?react-native|@react-native|react-native|expo(nent)?|@expo(nent)?/.*|expo-router|@expo-google-fonts/.*)/)"
  ]
};
