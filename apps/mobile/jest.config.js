module.exports = {
  preset: "jest-expo",
  testMatch: ["**/__tests__/**/*.test.[jt]s?(x)"],
  transformIgnorePatterns: [
    // Allow transforming Expo/Jest-Expo ESM deps (including nested deps under jest-expo/node_modules).
    "node_modules/(?!(jest-expo|expo-modules-core|(jest-)?react-native|@react-native|react-native|expo(nent)?|@expo(nent)?/.*|expo-router|@expo-google-fonts/.*)/)"
  ]
};
