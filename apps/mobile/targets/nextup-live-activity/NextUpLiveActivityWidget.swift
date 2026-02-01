import ActivityKit
import SwiftUI
import WidgetKit

struct NextUpLiveActivityView: View {
  let state: NextUpAttributes.ContentState

  private var taskText: String {
    let emoji = state.emoji?.trimmingCharacters(in: .whitespacesAndNewlines)
    if let emoji = emoji, !emoji.isEmpty {
      return "\(emoji) \(state.taskTitle)"
    }
    return state.taskTitle
  }

  var body: some View {
    HStack(alignment: .center, spacing: 12) {
      Image("FitNudgeLogo")
        .resizable()
        .scaledToFit()
        .frame(width: 44, height: 44)
        .clipShape(RoundedRectangle(cornerRadius: 10))

      // Today's focus + task title stacked in the center
      VStack(alignment: .leading, spacing: 4) {
        Text(state.title.isEmpty ? "Today's focus" : state.title)
          .font(.subheadline.weight(.bold))
          .foregroundColor(.primary)
          .lineLimit(2)
          .multilineTextAlignment(.leading)

        Text(taskText)
          .font(.caption.weight(.medium))
          .foregroundColor(.secondary)
          .lineLimit(2)
          .multilineTextAlignment(.leading)

        if state.totalCount > 1 {
          Text("\(state.completedCount) / \(state.totalCount)")
            .font(.caption2.weight(.semibold))
            .foregroundColor(.secondary)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)

      // Check icon on the far right
      Image(systemName: "checkmark.circle.fill")
        .font(.title2)
        .foregroundStyle(Color.blue)
        .symbolRenderingMode(.hierarchical)
    }
    .padding(.horizontal, 14)
    .padding(.vertical, 12)
    .activityBackgroundTint(Color.black)
  }
}

struct NextUpLiveActivityWidget: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: NextUpAttributes.self) { context in
      NextUpLiveActivityView(state: context.state)
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          Text("Today's focus").font(.subheadline.weight(.bold))
        }
        DynamicIslandExpandedRegion(.trailing) {
          if context.state.totalCount > 1 {
            Text("\(context.state.completedCount)/\(context.state.totalCount)")
              .font(.subheadline.weight(.semibold))
          }
        }
        DynamicIslandExpandedRegion(.bottom) {
          Text(context.state.emoji.map { "\($0) \(context.state.taskTitle)" } ?? context.state.taskTitle)
            .font(.headline.weight(.semibold))
            .lineLimit(2)
        }
      } compactLeading: {
        Text("Focus").fontWeight(.semibold)
      } compactTrailing: {
        Text(context.state.emoji ?? "•")
      } minimal: {
        Text(context.state.emoji ?? "•")
      }
    }
  }
}
