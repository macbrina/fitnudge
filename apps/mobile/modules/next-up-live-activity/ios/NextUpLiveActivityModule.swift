import ExpoModulesCore
import ActivityKit
import Foundation

public class NextUpLiveActivityModule: Module {
  private var observerTasks: [Task<Void, Never>] = []

  public func definition() -> ModuleDefinition {
    Name("NextUpLiveActivity")

    Events("pushToStartToken", "activityPushToken")

    Function("areActivitiesEnabled") { () -> Bool in
      if #available(iOS 16.1, *) {
        return ActivityAuthorizationInfo().areActivitiesEnabled
      } else {
        return false
      }
    }

    Function("startActivity") { (
      dayKey: String,
      nextTaskId: String,
      title: String,
      taskTitle: String,
      emoji: String?,
      completedCount: Int,
      totalCount: Int,
      bannerTitle: String?,
      bannerBody: String?
    ) -> Bool in
      if #available(iOS 16.1, *) {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return false }
        let state = NextUpAttributes.ContentState(
          dayKey: dayKey,
          nextTaskId: nextTaskId,
          title: title.isEmpty ? "Today's focus" : title,
          taskTitle: taskTitle,
          emoji: emoji,
          completedCount: completedCount,
          totalCount: totalCount
        )
        let content = ActivityContent(state: state, staleDate: nil)
        let alertConfig: AlertConfiguration? = { () -> AlertConfiguration? in
          guard let t = bannerTitle, !t.isEmpty, let b = bannerBody else { return nil }
          return AlertConfiguration(
            title: LocalizedStringResource(stringLiteral: t),
            body: LocalizedStringResource(stringLiteral: b),
            sound: .default
          )
        }()
        let existing = Activity<NextUpAttributes>.activities
        if !existing.isEmpty {
          Task {
            for activity in existing {
              if let config = alertConfig {
                await activity.update(content, alertConfiguration: config)
              } else {
                await activity.update(content)
              }
            }
          }
          return true
        }
        let attributes = NextUpAttributes(dayKey: dayKey)
        do {
          let activity = try Activity.request(
            attributes: attributes,
            content: content,
            pushType: .token
          )
          self.observeActivityPushToken(activity)
          if let config = alertConfig {
            Task {
              await activity.update(content, alertConfiguration: config)
            }
          }
          return true
        } catch {
          return false
        }
      }
      return false
    }

    Function("updateActivity") { (
      dayKey: String,
      nextTaskId: String,
      title: String,
      taskTitle: String,
      emoji: String?,
      completedCount: Int,
      totalCount: Int,
      bannerTitle: String?,
      bannerBody: String?
    ) -> Void in
      if #available(iOS 16.1, *) {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        let state = NextUpAttributes.ContentState(
          dayKey: dayKey,
          nextTaskId: nextTaskId,
          title: title.isEmpty ? "Today's focus" : title,
          taskTitle: taskTitle,
          emoji: emoji,
          completedCount: completedCount,
          totalCount: totalCount
        )
        let content = ActivityContent(state: state, staleDate: nil)
        let alertConfig: AlertConfiguration? = { () -> AlertConfiguration? in
          guard let t = bannerTitle, !t.isEmpty, let b = bannerBody else { return nil }
          return AlertConfiguration(
            title: LocalizedStringResource(stringLiteral: t),
            body: LocalizedStringResource(stringLiteral: b),
            sound: .default
          )
        }()
        Task {
          for activity in Activity<NextUpAttributes>.activities {
            if let config = alertConfig {
              await activity.update(content, alertConfiguration: config)
            } else {
              await activity.update(content)
            }
          }
        }
      }
    }

    Function("endActivity") { () -> Void in
      if #available(iOS 16.1, *) {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        Task {
          for activity in Activity<NextUpAttributes>.activities {
            await activity.end(nil, dismissalPolicy: .immediate)
          }
        }
      }
    }

    AsyncFunction("getPushToStartToken") { () async -> String? in
      if #available(iOS 17.2, *) {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return nil }
        for await token in Activity<NextUpAttributes>.pushToStartTokenUpdates {
          return token.map { String(format: "%02x", $0) }.joined()
        }
      }
      return nil
    }

    OnStartObserving {
      self.startObservingTokens()
    }

    OnStopObserving {
      self.stopObservingTokens()
    }
  }

  private func startObservingTokens() {
    stopObservingTokens()
    if #available(iOS 16.1, *) {
      let t1 = Task.detached { [weak self] in
        for await activity in Activity<NextUpAttributes>.activityUpdates {
          self?.observeActivityPushToken(activity)
        }
      }
      observerTasks.append(t1)

      if #available(iOS 17.2, *) {
        let t2 = Task.detached { [weak self] in
          for await token in Activity<NextUpAttributes>.pushToStartTokenUpdates {
            let hex = token.map { String(format: "%02x", $0) }.joined()
            self?.sendEvent("pushToStartToken", ["token": hex])
          }
        }
        observerTasks.append(t2)
      }
    }
  }

  private func stopObservingTokens() {
    for t in observerTasks { t.cancel() }
    observerTasks.removeAll()
  }

  private func observeActivityPushToken(_ activity: Activity<NextUpAttributes>) {
    if #available(iOS 16.1, *) {
      let activityId = activity.id
      let t = Task.detached { [weak self] in
        for await token in activity.pushTokenUpdates {
          let hex = token.map { String(format: "%02x", $0) }.joined()
          self?.sendEvent("activityPushToken", ["activityId": activityId, "token": hex])
        }
      }
      observerTasks.append(t)
    }
  }
}
