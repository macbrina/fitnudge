# Tabs Component

A robust, customizable tabs component with multiple variants, badge support, and animations.

## Features

- ✅ **3 Variants**: Default (chips), Pills (filled), Underline (minimal)
- ✅ **3 Sizes**: Small, Medium, Large
- ✅ **Badge Support**: Show counts on tabs
- ✅ **Icon Support**: Add icons to tabs
- ✅ **Animations**: Smooth sliding indicator (underline variant)
- ✅ **Scrollable**: Horizontal scrolling for many tabs
- ✅ **Full Width**: Equal width tabs option
- ✅ **Theme Aware**: Uses design system tokens and colors
- ✅ **Accessible**: Proper touch targets and visual feedback

## Basic Usage

```typescript
import { Tabs, TabItem } from "@/components/ui/Tabs";

const tabs: TabItem[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "completed", label: "Completed" },
];

const [selectedTab, setSelectedTab] = useState("all");

<Tabs
  tabs={tabs}
  selectedId={selectedTab}
  onChange={setSelectedTab}
/>
```

## Props

| Prop         | Type                                  | Default     | Description                   |
| ------------ | ------------------------------------- | ----------- | ----------------------------- |
| `tabs`       | `TabItem[]`                           | Required    | Array of tab items            |
| `selectedId` | `string`                              | Required    | ID of currently selected tab  |
| `onChange`   | `(id: string) => void`                | Required    | Callback when tab is selected |
| `variant`    | `"default" \| "pills" \| "underline"` | `"default"` | Visual style variant          |
| `size`       | `"sm" \| "md" \| "lg"`                | `"md"`      | Tab size                      |
| `fullWidth`  | `boolean`                             | `false`     | Make tabs equal width         |
| `scrollable` | `boolean`                             | `false`     | Enable horizontal scrolling   |
| `style`      | `ViewStyle`                           | `undefined` | Custom container styles       |

## TabItem Interface

```typescript
interface TabItem {
  id: string; // Unique identifier
  label: string; // Display text
  badge?: number; // Optional badge count
  icon?: ReactNode; // Optional icon component
}
```

## Variants

### 1. Default (Chips)

Bordered chips with background on selection.

```typescript
<Tabs
  tabs={tabs}
  selectedId={selectedTab}
  onChange={setSelectedTab}
  variant="default"
/>
```

**Visual**:

```
┌──────────┐  ┌──────────┐  ┌──────────┐
│   All    │  │  Active  │  │Completed │
└──────────┘  └──────────┘  └──────────┘
  Selected       Default       Default
```

### 2. Pills

Filled background on selection (like iOS segmented control).

```typescript
<Tabs
  tabs={tabs}
  selectedId={selectedTab}
  onChange={setSelectedTab}
  variant="pills"
/>
```

**Visual**:

```
┌──────────┐  ┌──────────┐  ┌──────────┐
│   All    │  │  Active  │  │Completed │
│ (filled) │  │   gray   │  │   gray   │
└──────────┘  └──────────┘  └──────────┘
  Selected       Default       Default
```

### 3. Underline

Minimal style with animated underline.

```typescript
<Tabs
  tabs={tabs}
  selectedId={selectedTab}
  onChange={setSelectedTab}
  variant="underline"
/>
```

**Visual**:

```
All        Active       Completed
───        ──────       ─────────
 ↑ Animated indicator slides on selection
```

## Sizes

### Small

```typescript
<Tabs tabs={tabs} selectedId={id} onChange={setId} size="sm" />
```

- Font size: `sm`
- Padding: `spacing[2]` vertical, `spacing[3]` horizontal
- Gap: `spacing[1]`

### Medium (Default)

```typescript
<Tabs tabs={tabs} selectedId={id} onChange={setId} size="md" />
```

- Font size: `base`
- Padding: `spacing[3]` vertical, `spacing[4]` horizontal
- Gap: `spacing[2]`

### Large

```typescript
<Tabs tabs={tabs} selectedId={id} onChange={setId} size="lg" />
```

- Font size: `lg`
- Padding: `spacing[4]` vertical, `spacing[5]` horizontal
- Gap: `spacing[3]`

## Advanced Examples

### With Badges

```typescript
const tabs: TabItem[] = [
  { id: "all", label: "All", badge: 42 },
  { id: "active", label: "Active", badge: 12 },
  { id: "completed", label: "Completed", badge: 30 },
];

<Tabs tabs={tabs} selectedId={selectedTab} onChange={setSelectedTab} />
```

**Visual**: Shows badge count next to label (e.g., "Active 12")

### With Icons

```typescript
import { Ionicons } from "@expo/vector-icons";

const tabs: TabItem[] = [
  {
    id: "all",
    label: "All",
    icon: <Ionicons name="grid" size={16} color={colors.text.secondary} />
  },
  {
    id: "active",
    label: "Active",
    icon: <Ionicons name="time" size={16} color={colors.text.secondary} />
  },
];

<Tabs tabs={tabs} selectedId={selectedTab} onChange={setSelectedTab} />
```

### Full Width Tabs

```typescript
<Tabs
  tabs={tabs}
  selectedId={selectedTab}
  onChange={setSelectedTab}
  fullWidth={true}
/>
```

Each tab takes equal width (`flex: 1`).

### Scrollable Tabs (Many tabs)

```typescript
const manyTabs: TabItem[] = [
  { id: "1", label: "Fitness" },
  { id: "2", label: "Nutrition" },
  { id: "3", label: "Wellness" },
  { id: "4", label: "Mindfulness" },
  { id: "5", label: "Sleep" },
  { id: "6", label: "Custom" },
];

<Tabs
  tabs={manyTabs}
  selectedId={selectedTab}
  onChange={setSelectedTab}
  scrollable={true}
/>
```

Wraps tabs in a horizontal ScrollView.

### Combined: Underline + Scrollable + Badges

```typescript
<Tabs
  tabs={statusTabs}
  selectedId={selectedTab}
  onChange={setSelectedTab}
  variant="underline"
  size="lg"
  scrollable={true}
/>
```

## Styling

### Custom Container Style

```typescript
<Tabs
  tabs={tabs}
  selectedId={selectedTab}
  onChange={setSelectedTab}
  style={{ marginBottom: 20 }}
/>
```

### Theme Colors Used

- **Text**: `colors.text.secondary` (unselected), `brand.primary` (selected)
- **Background**: `colors.bg.card` (default/pills), transparent (underline)
- **Border**: `colors.border.default` (default), `brand.primary` (selected)
- **Badge**: `brand.primary` background, `colors.text.onPrimary` text
- **Indicator**: `brand.primary` (underline variant)

## Comparison with SegmentedControl

| Feature        | Tabs                          | SegmentedControl          |
| -------------- | ----------------------------- | ------------------------- |
| **Variants**   | 3 (default, pills, underline) | 1 (fixed)                 |
| **Badges**     | ✅ Yes                        | ❌ No                     |
| **Icons**      | ✅ Yes                        | ❌ No                     |
| **Scrollable** | ✅ Yes                        | ❌ No                     |
| **Animation**  | ✅ Sliding indicator          | ✅ Sliding background     |
| **Use case**   | Flexible tabs system          | Simple 2-3 options toggle |

**When to use**:

- **Tabs**: Content sections, filters, navigation (2+ options)
- **SegmentedControl**: Binary/ternary choices (e.g., View mode toggle)

## Accessibility

- ✅ Proper touch targets (min 44x44)
- ✅ Active opacity feedback
- ✅ High contrast colors (theme-aware)
- ✅ Clear visual selection state
- ✅ Badge text readable (semiBold font)

## Performance

- ✅ Memoized styles via `useStyles`
- ✅ Optimized re-renders (only selected tab changes)
- ✅ Efficient animations (native driver for transforms)
- ✅ Layout measured once per tab

## Examples in App

### GoalsScreen (3 tabs with badges)

```typescript
const statusTabs: TabItem[] = [
  { id: "all", label: "All", badge: 42 },
  { id: "active", label: "Active", badge: 12 },
  { id: "completed", label: "Completed", badge: 30 },
];

<Tabs
  tabs={statusTabs}
  selectedId={statusFilter}
  onChange={setStatusFilter}
  variant="pills"
  size="md"
/>
```

### Settings Screen (Underline variant)

```typescript
const settingsTabs: TabItem[] = [
  { id: "general", label: "General" },
  { id: "notifications", label: "Notifications" },
  { id: "privacy", label: "Privacy" },
];

<Tabs
  tabs={settingsTabs}
  selectedId={selectedTab}
  onChange={setSelectedTab}
  variant="underline"
  fullWidth={true}
/>
```

### Analytics Screen (Scrollable with icons)

```typescript
const analyticsTabs: TabItem[] = [
  {
    id: "overview",
    label: "Overview",
    icon: <Ionicons name="stats-chart" size={16} />
  },
  {
    id: "goals",
    label: "Goals",
    icon: <Ionicons name="target" size={16} />
  },
  // ... more tabs
];

<Tabs
  tabs={analyticsTabs}
  selectedId={selectedTab}
  onChange={setSelectedTab}
  variant="default"
  scrollable={true}
/>
```

## Design System Compliance

✅ Uses design tokens for:

- Typography (`tokens.typography.fontSize`)
- Spacing (`tokens.spacing`)
- Border radius (`tokens.borderRadius`)
- Colors (`colors.*`, `brand.primary`)

✅ Uses font family:

- `fontFamily.medium` (unselected)
- `fontFamily.semiBold` (selected)

✅ Follows patterns from:

- `SegmentedControl` (animation approach)
- `Button` (touch feedback, sizing)
- `Card` (shadow and elevation)
