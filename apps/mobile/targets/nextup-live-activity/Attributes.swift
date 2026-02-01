import Foundation
import ActivityKit

// Must match server payload keys (stable contract).
public struct NextUpAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    public var dayKey: String
    public var nextTaskId: String
    public var title: String
    public var taskTitle: String
    public var emoji: String?
    public var completedCount: Int
    public var totalCount: Int
  }

  public var dayKey: String

  public init(dayKey: String) {
    self.dayKey = dayKey
  }
}
