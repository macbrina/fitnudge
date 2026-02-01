/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: "widget",
  name: "NextUpLiveActivityExtension",
  displayName: "Next up",
  bundleIdentifier: ".nextup-live-activity",
  frameworks: ["SwiftUI", "WidgetKit", "ActivityKit"],
  deploymentTarget: "17.2",
  icon: "../../assets/icon.png"
};
