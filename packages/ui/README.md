# 🎨 FitNudge UI - Shared Component Library

A shared component library built with shadcn/ui, providing consistent UI components across all FitNudge applications.

## 🎯 Purpose

- **Shared Components**: Reusable UI components for web, mobile, and admin
- **Design System**: Consistent design tokens and theming
- **Type Safety**: Full TypeScript support with proper typing
- **Accessibility**: WCAG 2.1 AA compliant components
- **Theme Support**: Light/dark mode with system detection

## 🚀 Features

### Core Components

- **Button**: Primary, secondary, destructive variants
- **Card**: Container with elevation and borders
- **Input**: Form inputs with validation states
- **Modal**: Overlay dialogs and popups
- **Table**: Data tables with sorting and filtering
- **Navigation**: Menus, tabs, and breadcrumbs

### Form Components

- **Form**: Form wrapper with validation
- **Input Group**: Labeled inputs with error states
- **Select**: Dropdown selections
- **Checkbox**: Boolean inputs
- **Radio**: Single selection inputs
- **Textarea**: Multi-line text inputs

### Layout Components

- **Container**: Responsive content containers
- **Grid**: CSS Grid layouts
- **Flex**: Flexbox utilities
- **Spacer**: Consistent spacing
- **Divider**: Visual separators

## 🛠️ Tech Stack

- **Framework**: React with TypeScript
- **Styling**: Tailwind CSS with design tokens
- **Base Library**: shadcn/ui components
- **Icons**: Lucide React icon library
- **Animations**: Framer Motion for smooth transitions
- **Accessibility**: React Aria for screen reader support

## 🚀 Development

### Prerequisites

- Node.js 18+
- pnpm

### Setup

```bash
# Install dependencies
pnpm install

# Build the package
pnpm build

# Start development
pnpm dev
```

## 📁 Project Structure

```
packages/ui/
├── src/
│   ├── components/         # React components
│   │   ├── button.tsx     # Button component
│   │   ├── card.tsx       # Card component
│   │   ├── input.tsx      # Input component
│   │   └── index.ts       # Component exports
│   ├── styles/            # Style factory functions
│   │   ├── button.styles.ts
│   │   ├── card.styles.ts
│   │   └── index.ts
│   ├── hooks/             # Custom React hooks
│   ├── utils/             # Utility functions
│   └── types/             # TypeScript types
├── dist/                  # Built package
├── package.json
└── tsconfig.json
```

## 🎨 Design System Integration

### Color Tokens

```typescript
// Light mode colors
const lightColors = {
  background: "#ffffff",
  foreground: "#0f172a",
  primary: "#2563eb",
  success: "#10b981",
  warning: "#f59e0b",
  destructive: "#ef4444",
  // ... more colors
};

// Dark mode colors
const darkColors = {
  background: "#0f172a",
  foreground: "#f8fafc",
  primary: "#3b82f6",
  success: "#34d399",
  warning: "#fbbf24",
  destructive: "#dc2626",
  // ... more colors
};
```

### Typography

```typescript
const typography = {
  fontFamily: {
    primary: "Space Grotesk, system-ui, sans-serif",
    mono: "JetBrains Mono, monospace",
  },
  fontSize: {
    xs: "12px",
    sm: "14px",
    base: "16px",
    lg: "18px",
    xl: "20px",
    "2xl": "24px",
    "3xl": "30px",
    "4xl": "36px",
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
};
```

### Spacing Scale

```typescript
const spacing = {
  xs: "4px", // 0.25rem
  sm: "8px", // 0.5rem
  md: "16px", // 1rem
  lg: "24px", // 1.5rem
  xl: "32px", // 2rem
  "2xl": "48px", // 3rem
  "3xl": "64px", // 4rem
};
```

## 🧩 Component Usage

### Basic Usage

```typescript
import { Button, Card, Input } from '@fitnudge/ui';

function MyComponent() {
  return (
    <Card>
      <Input placeholder="Enter your goal" />
      <Button variant="primary">Create Goal</Button>
    </Card>
  );
}
```

### With Style Factory

```typescript
import { makeButtonStyles } from '@fitnudge/ui/styles';
import { theme } from '@/themes';

function CustomButton() {
  const styles = makeButtonStyles(theme);

  return (
    <button style={styles.primary}>
      Custom Button
    </button>
  );
}
```

### Theme-Aware Components

```typescript
import { useTheme } from '@fitnudge/ui/hooks';

function ThemedComponent() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className={theme === 'dark' ? 'bg-slate-900' : 'bg-white'}>
      <button onClick={toggleTheme}>
        Toggle Theme
      </button>
    </div>
  );
}
```

## 🎯 Component Variants

### Button Variants

```typescript
<Button variant="primary">Primary Action</Button>
<Button variant="secondary">Secondary Action</Button>
<Button variant="destructive">Delete</Button>
<Button variant="success">Success</Button>
<Button variant="warning">Warning</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="outline">Outline</Button>
```

### Card Variants

```typescript
<Card variant="default">Default Card</Card>
<Card variant="elevated">Elevated Card</Card>
<Card variant="outlined">Outlined Card</Card>
<Card variant="filled">Filled Card</Card>
```

### Input States

```typescript
<Input placeholder="Normal input" />
<Input placeholder="Error input" error />
<Input placeholder="Success input" success />
<Input placeholder="Warning input" warning />
<Input placeholder="Disabled input" disabled />
```

## 🧪 Testing

```bash
# Run component tests
pnpm test

# Run with coverage
pnpm test:coverage

# Run visual regression tests
pnpm test:visual
```

## 📦 Building

```bash
# Build the package
pnpm build

# Build with type checking
pnpm build:types

# Build for production
pnpm build:prod
```

## 🚀 Publishing

```bash
# Publish to npm registry
pnpm publish

# Publish with version bump
pnpm version patch
pnpm publish
```

## 🔗 Integration

### Next.js (Web/Admin)

```typescript
// tailwind.config.js
module.exports = {
  content: ["./packages/ui/src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Design system colors
      },
    },
  },
};
```

### React Native (Mobile)

```typescript
// Import components
import { Button, Card } from '@fitnudge/ui';

// Use with React Native
<Button onPress={handlePress}>
  Mobile Button
</Button>
```

## 📚 Documentation

- **Storybook**: Interactive component documentation
- **TypeScript**: Full type definitions and IntelliSense
- **Examples**: Usage examples for each component
- **Accessibility**: WCAG compliance documentation

## 🔗 Related Documentation

- [Architecture.md](../../apps/docs/Architecture.md) - System architecture
- [ProjectOverview.md](../../apps/docs/ProjectOverview.md) - Design system overview
