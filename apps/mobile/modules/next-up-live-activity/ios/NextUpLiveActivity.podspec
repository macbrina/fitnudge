Pod::Spec.new do |s|
  s.name           = 'NextUpLiveActivity'
  s.version        = '1.0.0'
  s.summary        = "Today's focus Live Activity for FitNudge"
  s.description    = 'Expo module for starting/updating/ending iOS Live Activities and observing push tokens'
  s.author         = ''
  s.homepage       = 'https://github.com/macbrina/fitnudge'
  s.platforms      = { :ios => '17.2' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.frameworks = 'ActivityKit', 'SwiftUI'

  s.source_files = "**/*.swift"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
