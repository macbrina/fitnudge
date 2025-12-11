# GoalsScreen Design Document

## 🎯 User Goals

Users need to:

1. **View all goals** in one place (active, completed, archived)
2. **Find specific goals** quickly (search, filter, sort)
3. **Manage goals** (activate, archive, delete, duplicate)
4. **See progress** at a glance (stats, streaks, completion rates)
5. **Create new goals** easily

## 📐 Layout Structure

```
┌─────────────────────────────────────┐
│ Header                               │
│ - Title: "My Goals"                 │
│ - Stats: "5 Active • 3 Completed"   │
│ - Create Button (FAB or Header)     │
├─────────────────────────────────────┤
│ Search Bar                           │
│ [🔍 Search goals...]                 │
├─────────────────────────────────────┤
│ Status Tabs                          │
│ [All] [Active] [Completed]           │
├─────────────────────────────────────┤
│ Category Filters (Chips)             │
│ [All] [💪 Fitness] [🥗 Nutrition]... │
├─────────────────────────────────────┤
│ Sort Dropdown                        │
│ [Sort: Recent ▼]                     │
├─────────────────────────────────────┤
│ Goals List                           │
│ ┌─────────────────────────────────┐ │
│ │ Goal Card 1                     │ │
│ │ - Title, Category, Streak        │ │
│ │ - Plan Status Badge             │ │
│ │ - Actions (3 dots menu)         │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ Goal Card 2                     │ │
│ └─────────────────────────────────┘ │
│ ...                                  │
├─────────────────────────────────────┤
│ Empty State (if no goals)            │
│ - Icon, Message, CTA                │
└─────────────────────────────────────┘
```

## 🎨 Component Breakdown

### 1. Header Section

- **Title**: "My Goals"
- **Stats**: Quick stats (Active count, Completed count)
- **Create Button**: Floating Action Button (FAB) or header button

### 2. Search Bar

- **Placeholder**: "Search goals..."
- **Icon**: Search icon on left
- **Clear button**: X icon when text entered
- **Real-time filtering**: Filter as user types

### 3. Status Tabs (Segmented Control)

- **Tabs**: All | Active | Completed
- **Default**: Active
- **Visual**: Selected tab highlighted

### 4. Category Filter Chips

- **Chips**: All | 💪 Fitness | 🥗 Nutrition | 🧘 Wellness | 🧠 Mindfulness | 😴 Sleep | 🎯 Custom
- **Behavior**: Multiple selection allowed
- **Visual**: Selected chips highlighted

### 5. Sort Dropdown

- **Options**:
  - Recent (newest first)
  - Oldest first
  - Alphabetical (A-Z)
  - Alphabetical (Z-A)
  - Streak (highest first)
  - Streak (lowest first)
- **UI**: Dropdown or action sheet

### 6. Goals List

- **Component**: Reuse `GoalCard` from HomeScreen
- **Layout**: Vertical list (full width cards)
- **Features**:
  - Pull to refresh
  - Infinite scroll (if many goals)
  - Swipe actions (archive, delete)

### 7. Goal Card Actions Menu

- **3-dot menu** on each card:
  - View Details
  - Edit Goal
  - Duplicate Goal
  - Archive/Unarchive
  - Activate/Deactivate
  - Delete Goal

### 8. Empty States

- **No goals**: "Create your first goal!"
- **No results (filtered)**: "No goals match your filters"
- **No active goals**: "All goals are completed"

## 🔍 Filtering Logic

### Status Filter

```typescript
if (statusFilter === "active") {
  return goals.filter((g) => g.is_active === true);
} else if (statusFilter === "completed") {
  return goals.filter((g) => g.is_active === false);
}
return goals; // "all"
```

### Category Filter

```typescript
if (selectedCategories.length > 0 && !selectedCategories.includes("all")) {
  return goals.filter((g) => selectedCategories.includes(g.category));
}
return goals;
```

### Search Filter

```typescript
const searchLower = searchQuery.toLowerCase();
return goals.filter(
  (g) =>
    g.title.toLowerCase().includes(searchLower) ||
    g.description?.toLowerCase().includes(searchLower)
);
```

### Sort Logic

```typescript
switch (sortBy) {
  case "recent":
    return [...goals].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );
  case "oldest":
    return [...goals].sort(
      (a, b) => new Date(a.created_at) - new Date(b.created_at)
    );
  case "alphabetical-asc":
    return [...goals].sort((a, b) => a.title.localeCompare(b.title));
  case "alphabetical-desc":
    return [...goals].sort((a, b) => b.title.localeCompare(a.title));
  case "streak-high":
    return [...goals].sort(
      (a, b) => (b.current_streak || 0) - (a.current_streak || 0)
    );
  case "streak-low":
    return [...goals].sort(
      (a, b) => (a.current_streak || 0) - (b.current_streak || 0)
    );
}
```

## 📱 User Flows

### Flow 1: View Active Goals

1. User opens Goals tab
2. Sees "Active" tab selected by default
3. Views list of active goals
4. Can tap goal to view details

### Flow 2: Search for Goal

1. User types in search bar
2. List filters in real-time
3. User finds goal and taps it

### Flow 3: Filter by Category

1. User taps category chip (e.g., "Fitness")
2. List filters to show only fitness goals
3. User can tap "All" to clear filter

### Flow 4: Archive Goal

1. User taps 3-dot menu on goal card
2. Selects "Archive"
3. Goal moves to "Completed" tab
4. Confirmation toast appears

### Flow 5: Create Goal

1. User taps FAB or "Create Goal" button
2. Navigates to CreateGoalScreen
3. Creates goal
4. Returns to GoalsScreen with new goal visible

## 🎨 Design Tokens

- **Spacing**: Follow design system tokens
- **Colors**: Use theme colors
- **Typography**: Use fontFamily from design system
- **Components**: Reuse Card, Button, SegmentedControl

## 🔄 State Management

```typescript
interface GoalsScreenState {
  searchQuery: string;
  statusFilter: "all" | "active" | "completed";
  selectedCategories: string[];
  sortBy:
    | "recent"
    | "oldest"
    | "alphabetical-asc"
    | "alphabetical-desc"
    | "streak-high"
    | "streak-low";
  showSortMenu: boolean;
  refreshing: boolean;
}
```

## 📊 Performance Considerations

1. **Client-side filtering**: Fast for < 100 goals
2. **Memoization**: Use `useMemo` for filtered/sorted goals
3. **Virtualization**: Use `FlatList` for large lists
4. **Debounce search**: Debounce search input (300ms)

## 🚀 Future Enhancements

1. **Backend filtering**: Add query params to API
2. **Infinite scroll**: Load more goals as user scrolls
3. **Bulk actions**: Select multiple goals for bulk archive/delete
4. **Goal templates**: Quick create from templates
5. **Analytics**: Show completion rates, trends
