# FitNudge Design System Implementation Guide

> **Critical**: This guide ensures Cursor generates code that strictly follows FitNudge's token-based architecture. Read the ALWAYS and NEVER rules first before generating any component.

---

## Part 1: Critical Coding Rules

### 🚫 NEVER Rules

These rules are **non-negotiable**. Code that violates them will be rejected.

1. **NEVER hardcode colors**

   ```tsx
   // ❌ WRONG
   <View style={{ backgroundColor: '#2563eb' }} />
   <Text style={{ color: 'blue' }} />

   // ✅ CORRECT
   <View style={{ backgroundColor: colors.bg.canvas }} />
   <Text style={{ color: colors.text.primary }} />
   ```

2. **NEVER use inline styles with hardcoded values**

   ```tsx
   // ❌ WRONG
   <View style={{ padding: 16, margin: 8 }} />

   // ✅ CORRECT
   <View style={styles.container} />
   // Where styles.container uses: padding: toRN(tokens.spacing[4])
   ```

3. **NEVER bypass the useStyles hook**

   ```tsx
   // ❌ WRONG
   const styles = StyleSheet.create({
     container: { padding: 16 },
   });

   // ✅ CORRECT
   const styles = useStyles(makeComponentStyles);
   ```

4. **NEVER import StyleSheet.create directly in components**

   ```tsx
   // ❌ WRONG
   import { StyleSheet } from 'react-native';
   const styles = StyleSheet.create({...});

   // ✅ CORRECT
   import { useStyles } from '@/themes';
   const styles = useStyles(makeComponentStyles);
   ```

5. **NEVER use raw token strings without toRN() conversion**

   ```tsx
   // ❌ WRONG
   padding: tokens.spacing[4]; // "1rem" string won't work in React Native

   // ✅ CORRECT
   padding: toRN(tokens.spacing[4]); // Converts "1rem" to 16
   ```

6. **NEVER use undefined color values**

   ```tsx
   // ❌ WRONG
   backgroundColor: colors.unknown; // Undefined property

   // ✅ CORRECT
   backgroundColor: colors.bg.card; // Always use defined semantic colors
   ```

7. **NEVER mix token and hardcoded values in same style object**

   ```tsx
   // ❌ WRONG
   {
     padding: toRN(tokens.spacing[4]),
     margin: 20  // Hardcoded!
   }

   // ✅ CORRECT
   {
     padding: toRN(tokens.spacing[4]),
     margin: toRN(tokens.spacing[5])
   }
   ```

8. **NEVER create new spacing/color values - always use existing tokens**

   ```tsx
   // ❌ WRONG
   padding: 14; // Random value not in token system

   // ✅ CORRECT
   padding: toRN(tokens.spacing[3.5]); // Use closest token, or add to tokens.ts first
   ```

9. **NEVER skip theme context - always use useTheme() for dynamic values**

   ```tsx
   // ❌ WRONG
   const backgroundColor = "#ffffff"; // Static, doesn't adapt to dark mode

   // ✅ CORRECT
   const { colors } = useTheme();
   const backgroundColor = colors.bg.card; // Adapts to theme
   ```

10. **NEVER use direct color imports - always via theme context**

    ```tsx
    // ❌ WRONG
    import { tokens } from "@/themes/tokens";
    backgroundColor: tokens.colors.light.primary; // Wrong! Doesn't adapt to dark mode

    // ✅ CORRECT
    const { colors, brand } = useTheme();
    backgroundColor: colors.bg.canvas; // Adapts to light/dark mode
    ```

11. **ALL DESIGN MUST LOOK GOOD ON IOS AND ANDROID AND COMPATIBLE**

---

### ✅ ALWAYS Rules

These patterns must be followed in **every** component.

1. **ALWAYS use `useStyles(makeComponentStyles)` hook pattern**

   ```tsx
   const styles = useStyles(makeComponentStyles);
   ```

2. **ALWAYS import tokens from `@/themes/tokens`**

   ```tsx
   import { tokens } from "@/themes/tokens";
   ```

3. **ALWAYS use `toRN()` converter for token values in styles**

   ```tsx
   padding: toRN(tokens.spacing[4]),
   borderRadius: toRN(tokens.borderRadius.xl),
   ```

4. **ALWAYS access colors via `colors.bg.*`, `colors.text.*` from useTheme()**

   ```tsx
   const { colors } = useTheme();
   backgroundColor: colors.bg.card,
   color: colors.text.primary,
   ```

5. **ALWAYS use brand colors via `brandColors.*` from useTheme()**

   ```tsx
   const { brandColors } = useTheme();
   backgroundColor: brandColors.primary,
   borderColor: brandColors.primary,
   ```

6. **ALWAYS define makeStyles function with `(tokens, colors, brand)` signature**

   ```tsx
   const makeComponentStyles = (tokens: any, colors: any, brand: any) => ({
     container: {
       // styles here
     },
   });
   ```

7. **ALWAYS use spacing tokens: `toRN(tokens.spacing[4])`**

   ```tsx
   padding: toRN(tokens.spacing[4]),      // 1rem = 16px
   margin: toRN(tokens.spacing[6]),       // 1.5rem = 24px
   gap: toRN(tokens.spacing[2]),          // 0.5rem = 8px
   ```

8. **ALWAYS use typography tokens: `fontSize: tokens.typography.fontSize.xl`**

   ```tsx
   fontSize: toRN(tokens.typography.fontSize.xl),  // 1.25rem = 20px
   fontFamily: fontFamily.bold,   // "700"
   ```

9. **ALWAYS use border radius tokens: `borderRadius: toRN(tokens.borderRadius.xl)`**

   ```tsx
   borderRadius: toRN(tokens.borderRadius.xl),     // 0.75rem = 12px
   borderRadius: toRN(tokens.borderRadius.full),   // 9999px (fully rounded)
   ```

10. **ALWAYS use shadow presets from Card component or define similar patterns**

    ```tsx
    // Use existing shadow presets or create consistent ones
    shadowColor: colors.shadow.lg,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 18,
    shadowOpacity: 0.16,
    elevation: 6,
    ```

11. **ALWAYS use SkeletonBox component for loading states**

    ```tsx
    // ❌ WRONG - Using ActivityIndicator for loading states
    {
      isLoading && <ActivityIndicator />;
    }

    // ✅ CORRECT - Use SkeletonBox components for loading states
    import {
      SkeletonBox,
      SkeletonCard,
      SkeletonText,
    } from "@/components/ui/SkeletonBox";

    {
      isLoading ? <SkeletonCard /> : <Card>Content</Card>;
    }
    ```

---

### 📦 Required Imports Template

Every component that uses styling must include these imports:

```tsx
import React from "react";
import { View, Text, StyleProp, ViewStyle } from "react-native";
import { useStyles } from "@/themes";
import { useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
```

**For Alert Modals**: Always use `AlertModalContext` instead of `Alert.alert`:

```tsx
import { useAlertModal } from "@/contexts/AlertModalContext";

const { showAlert, showConfirm, showToast } = useAlertModal();
```

---

### 🏗️ Component Structure Template

Every styled component must follow this structure:

```tsx
import React from "react";
import { View, Text } from "react-native";
import { useStyles } from "@/themes";
import { useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";

interface ComponentProps {
  // props here
}

export default function Component({ ...props }: ComponentProps) {
  const styles = useStyles(makeComponentStyles);
  const { colors, brand } = useTheme();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Content</Text>
    </View>
  );
}

// Style function MUST follow this exact pattern
const makeComponentStyles = (tokens: any, colors: any, brand: any) => {
  return {
    container: {
      backgroundColor: colors.bg.card,
      padding: toRN(tokens.spacing[4]),
      borderRadius: toRN(tokens.borderRadius.xl),
    },
    title: {
      fontSize: toRN(tokens.typography.fontSize.xl),
      fontFamily: fontFamily.bold,
      color: colors.text.primary,
    },
  };
};
```

---

## Part 2: Token System Reference

### 📏 Spacing Tokens

**Location**: `apps/mobile/src/themes/tokens.ts`

**Available Values**:

```tsx
tokens.spacing[0]; // "0" = 0px
tokens.spacing[1]; // "0.25rem" = 4px
tokens.spacing[2]; // "0.5rem" = 8px
tokens.spacing[3]; // "0.75rem" = 12px
tokens.spacing[4]; // "1rem" = 16px
tokens.spacing[5]; // "1.25rem" = 20px
tokens.spacing[6]; // "1.5rem" = 24px
tokens.spacing[8]; // "2rem" = 32px
tokens.spacing[10]; // "2.5rem" = 40px
tokens.spacing[12]; // "3rem" = 48px
tokens.spacing[16]; // "4rem" = 64px
// ... up to 64
```

**Usage Examples**:

```tsx
const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    padding: toRN(tokens.spacing[4]), // 16px
    paddingHorizontal: toRN(tokens.spacing[5]), // 20px
    paddingVertical: toRN(tokens.spacing[3]), // 12px
    margin: toRN(tokens.spacing[2]), // 8px
    gap: toRN(tokens.spacing[4]), // 16px
  },
});
```

**Common Spacing Patterns**:

- **Card padding**: `toRN(tokens.spacing[5])` (20px)
- **Section spacing**: `toRN(tokens.spacing[6])` (24px)
- **Element gap**: `toRN(tokens.spacing[4])` (16px)
- **Screen padding**: `toRN(tokens.spacing[4])` (16px)
- **Tight spacing**: `toRN(tokens.spacing[2])` (8px)

---

### ✍️ Typography Tokens

**Location**: `apps/mobile/src/themes/tokens.ts`

**Font Sizes**:

````tsx
tokens.typography.fontSize.xs; // "0.75rem" = 12px
tokens.typography.fontSize.sm; // "0.875rem" = 14px
tokens.typography.fontSize.base; // "1rem" = 16px
tokens.typography.fontSize.lg; // "1.125rem" = 18px
tokens.typography.fontSize.xl; // "1.25rem" = 20px
tokens.typography.fontSize["2xl"]; // "1.5rem" = 24px
tokens.typography.fontSize["3xl"]; // "1.875rem" = 30px
tokens.typography.fontSize["4xl"]; // "2.25rem" = 36px
tokens.typography.fontSize["5xl"]; // "3rem" = 48px
tokens.typography.fontSize["6xl"]; // "3.75rem" = 60px


**Line Heights** (use with `lineHeight()` helper):

```tsx
import { lineHeight } from "@/themes/tokens";

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  title: {
    fontSize: toRN(tokens.typography.fontSize["3xl"]),
    lineHeight: lineHeight(
      tokens.typography.fontSize["3xl"],
      tokens.typography.lineHeight.tight
    ),
  },
});
````

**Usage Examples**:

```tsx
const makeStyles = (tokens: any, colors: any, brand: any) => ({
  title: {
    fontSize: toRN(tokens.typography.fontSize["2xl"]),
    fontFamily: fontFamily.bold,
    color: colors.text.primary,
  },
  body: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
  },
  caption: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium
    color: colors.text.tertiary,
  },
});
```

**Typography Hierarchy**:

- **Hero/Display**: `fontSize["4xl"]` or `["5xl"]` with `bold`
- **H1**: `fontSize["3xl"]` with `bold`
- **H2**: `fontSize["2xl"]` with `semibold`
- **H3**: `fontSize.xl` with `semibold`
- **Body**: `fontSize.base` with `normal`
- **Caption**: `fontSize.sm` with `normal` or `medium`

---

### 🎨 Color Tokens

**Location**: `apps/mobile/src/themes/semanticColors.ts` (accessed via `useTheme()`)

**Color Access Pattern**:

```tsx
const { colors, brand } = useTheme();

// Background colors
colors.bg.canvas; // Main app background
colors.bg.card; // Card/surface background
colors.bg.primary; // Primary brand background
colors.bg.secondary; // Secondary background
colors.bg.muted; // Muted/subtle background
colors.bg.surface; // Surface element background
colors.bg.accent; // Accent background
colors.bg.destructive; // Error/danger background
colors.bg.success; // Success state background
colors.bg.warning; // Warning state background
colors.bg.overlay; // Modal overlay

// Text colors
colors.text.primary; // Primary text color
colors.text.secondary; // Secondary text color
colors.text.tertiary; // Tertiary/subtle text
colors.text.muted; // Muted text color
colors.text.onPrimary; // Text on primary background
colors.text.onSecondary; // Text on secondary background
colors.text.onAccent; // Text on accent background
colors.text.onDestructive; // Text on error background
colors.text.onSuccess; // Text on success background
colors.text.onWarning; // Text on warning background

// Border colors
colors.border.default; // Default border color
colors.border.input; // Input border color
colors.border.ring; // Focus ring color

// Brand colors (from brand object)
brand.primary; // Primary brand color (#2563EB)
brand.secondary; // Secondary brand color (if defined)

// Shadow colors
colors.shadow.sm; // Small shadow opacity
colors.shadow.md; // Medium shadow opacity
colors.shadow.lg; // Large shadow opacity
colors.shadow.xl; // Extra large shadow opacity
```

**Usage Examples**:

```tsx
const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    backgroundColor: colors.bg.card,
    borderColor: colors.border.default,
  },
  title: {
    color: colors.text.primary,
  },
  subtitle: {
    color: colors.text.tertiary,
  },
  button: {
    backgroundColor: brand.primary,
  },
  buttonText: {
    color: colors.text.onPrimary,
  },
});
```

**Important**: Colors automatically adapt to light/dark mode. Never hardcode color values.

---

### 🌑 Border Radius Tokens

**Location**: `apps/mobile/src/themes/tokens.ts`

**Available Values**:

```tsx
tokens.borderRadius.none; // "0"
tokens.borderRadius.sm; // "0.125rem" = 2px
tokens.borderRadius.base; // "0.25rem" = 4px
tokens.borderRadius.md; // "0.375rem" = 6px
tokens.borderRadius.lg; // "0.5rem" = 8px
tokens.borderRadius.xl; // "0.75rem" = 12px
tokens.borderRadius["2xl"]; // "1rem" = 16px
tokens.borderRadius["3xl"]; // "1.5rem" = 24px
tokens.borderRadius.full; // "9999px" (fully rounded)
```

**Usage Examples**:

```tsx
const makeStyles = (tokens: any, colors: any, brand: any) => ({
  card: {
    borderRadius: toRN(tokens.borderRadius.xl), // 12px
  },
  button: {
    borderRadius: toRN(tokens.borderRadius.full), // Fully rounded
  },
  input: {
    borderRadius: toRN(tokens.borderRadius.md), // 6px
  },
});
```

**Common Patterns**:

- **Cards**: `borderRadius.xl` (12px)
- **Buttons**: `borderRadius.full` (fully rounded)
- **Inputs**: `borderRadius.md` or `borderRadius.lg` (6-8px)
- **Badges**: `borderRadius.full` (fully rounded)
- **Images**: `borderRadius.xl` or `borderRadius["2xl"]` (12-16px)

---

### 🌊 Shadow Tokens

**Location**: Shadow colors from `colors.shadow.*`, presets in Card component

**Shadow Presets** (from Card component pattern):

```tsx
const SHADOW_PRESETS = {
  sm: {
    offset: { width: 0, height: 2 },
    radius: 6,
    elevation: 2,
    opacity: 0.08,
  },
  md: {
    offset: { width: 0, height: 6 },
    radius: 12,
    elevation: 4,
    opacity: 0.12,
  },
  lg: {
    offset: { width: 0, height: 12 },
    radius: 18,
    elevation: 6,
    opacity: 0.16,
  },
  xl: {
    offset: { width: 0, height: 18 },
    radius: 28,
    elevation: 9,
    opacity: 0.24,
  },
};
```

**Usage Examples**:

```tsx
const makeStyles = (tokens: any, colors: any, brand: any) => ({
  elevatedCard: {
    shadowColor: colors.shadow.lg,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 18,
    shadowOpacity: 0.16,
    elevation: 6,
  },
  subtleCard: {
    shadowColor: colors.shadow.sm,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    shadowOpacity: 0.08,
    elevation: 2,
  },
});
```

**Best Practice**: Use the Card component's shadow prop instead of manually defining shadows:

```tsx
<Card shadow="lg">
  {" "}
  // Automatically applies correct shadow
  {children}
</Card>
```

---

## Part 3: Component Implementation Recipes

### 🏗️ Base Component Template

**Required Structure** for all styled components:

```tsx
import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useStyles } from "@/themes";
import { useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { fontFamily } from "@/lib/fonts";
import { toRN } from "@/lib/units";

interface MyComponentProps {
  title: string;
  onPress?: () => void;
}

export default function MyComponent({ title, onPress }: MyComponentProps) {
  const styles = useStyles(makeMyComponentStyles);
  const { colors, brand } = useTheme();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {onPress && (
        <TouchableOpacity onPress={onPress} style={styles.button}>
          <Text style={styles.buttonText}>Action</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// Style function - MUST have this exact signature
const makeMyComponentStyles = (tokens: any, colors: any, brand: any) => {
  return {
    container: {
      backgroundColor: colors.bg.card,
      padding: toRN(tokens.spacing[4]),
      borderRadius: toRN(tokens.borderRadius.xl),
    },
    title: {
      fontSize: toRN(tokens.typography.fontSize.xl),
      fontFamily: fontFamily.bold,
      color: colors.text.primary,
      marginBottom: toRN(tokens.spacing[2]),
    },
    button: {
      backgroundColor: brand.primary,
      padding: toRN(tokens.spacing[3]),
      borderRadius: toRN(tokens.borderRadius.full),
    },
    buttonText: {
      fontSize: toRN(tokens.typography.fontSize.base),
      fontFamily: fontFamily.semibold
      color: colors.text.onPrimary,
    },
  };
};
```

---

### 📝 makeStyles Function Pattern

**Exact Pattern** to follow:

```tsx
// Function signature MUST be exactly this:
const makeComponentStyles = (tokens: any, colors: any, brand: any) => {
  return {
    // Style object with all styles
    container: {
      // Use tokens with toRN() converter
      padding: toRN(tokens.spacing[4]),
      // Use colors from theme
      backgroundColor: colors.bg.card,
      // Use brand colors
      borderColor: brand.primary,
      // Use border radius tokens
      borderRadius: toRN(tokens.borderRadius.xl),
    },
  };
};
```

**Important Notes**:

- Function name: `make[ComponentName]Styles` (camelCase)
- Parameters: Always `(tokens: any, colors: any, brand: any)`
- Return: Object with style definitions
- Use `toRN()` for all spacing, border radius, and size values
- Use `colors.*` for all color values (never hardcode)
- Use `brand.*` for brand colors

---

### 🪝 useStyles Hook Usage

**Pattern**:

```tsx
// At the top of component
const styles = useStyles(makeComponentStyles);

// Use in JSX
<View style={styles.container}>
```

**Important**:

- Call `useStyles()` once at the top of component
- Pass the makeStyles function (not call it)
- Styles are memoized automatically
- Styles adapt to theme changes automatically

---

### 🎨 useTheme Hook Usage

**Pattern**:

```tsx
const { colors, brand } = useTheme();

// Use in style function via parameters, or inline if needed
<View style={{ backgroundColor: colors.bg.card }}>
```

**Best Practice**: Access colors in style function via parameters, not from hook:

```tsx
// ✅ BETTER - Access via style function parameters
const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    backgroundColor: colors.bg.card, // From parameter
  },
});

// ❌ WORSE - Accessing from hook in component
const { colors } = useTheme();
const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    backgroundColor: colors.bg.card, // Parameter shadows hook, confusing
  },
});
```

---

### 📦 Complete Component Examples

#### Example 1: Simple Card Component

```tsx
import React from "react";
import { View, Text } from "react-native";
import { Card } from "@/components/ui/Card";
import { useStyles } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";

interface InfoCardProps {
  title: string;
  description: string;
}

export default function InfoCard({ title, description }: InfoCardProps) {
  const styles = useStyles(makeInfoCardStyles);

  return (
    <Card shadow="md" style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </Card>
  );
}

const makeInfoCardStyles = (tokens: any, colors: any, brand: any) => ({
  card: {
    marginBottom: toRN(tokens.spacing[4]),
  },
  title: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.bold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[2]),
  },
  description: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    lineHeight: toRN(tokens.typography.fontSize.base) * 1.5,
  },
});
```

#### Example 2: Button Component

```tsx
import React from "react";
import { TouchableOpacity, Text } from "react-native";
import { useStyles } from "@/themes";
import { useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}

export default function PrimaryButton({
  title,
  onPress,
  disabled = false,
}: PrimaryButtonProps) {
  const styles = useStyles(makePrimaryButtonStyles);
  const { colors, brand } = useTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[styles.button, disabled && { opacity: 0.5 }]}
      activeOpacity={0.8}
    >
      <Text style={styles.buttonText}>{title}</Text>
    </TouchableOpacity>
  );
}

const makePrimaryButtonStyles = (tokens: any, colors: any, brand: any) => ({
  button: {
    backgroundColor: brand.primary,
    paddingVertical: toRN(tokens.spacing[3]),
    paddingHorizontal: toRN(tokens.spacing[6]),
    borderRadius: toRN(tokens.borderRadius.full),
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.shadow.md,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    shadowOpacity: 0.12,
    elevation: 4,
  },
  buttonText: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semibold
    color: colors.text.onPrimary,
  },
});
```

#### Example 3: Input Field Component

```tsx
import React, { useState } from "react";
import { View, TextInput, Text } from "react-native";
import { useStyles } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";

interface TextInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
}

export default function TextInput({
  label,
  value,
  onChangeText,
  placeholder,
  error,
}: TextInputProps) {
  const styles = useStyles(makeTextInputStyles);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={styles.placeholder.color}
        style={[styles.input, error && styles.inputError]}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const makeTextInputStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    marginBottom: toRN(tokens.spacing[4]),
  },
  label: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[2]),
  },
  input: {
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.border.input,
    borderRadius: toRN(tokens.borderRadius.md),
    padding: toRN(tokens.spacing[3]),
    fontSize: toRN(tokens.typography.fontSize.base),
    color: colors.text.primary,
  },
  inputError: {
    borderColor: colors.bg.destructive,
  },
  placeholder: {
    color: colors.text.tertiary,
  },
  errorText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    color: colors.bg.destructive,
    marginTop: toRN(tokens.spacing[1]),
  },
});
```

---

### 📦 Loading States

**ALWAYS use SkeletonBox components for loading states instead of ActivityIndicator.**

**Available Components**:

- `SkeletonBox` - Base skeleton component
- `SkeletonCard` - Card-shaped skeleton
- `SkeletonText` - Text line skeletons
- `SkeletonButton` - Button-shaped skeleton
- `SkeletonAvatar` - Circular avatar skeleton
- `SkeletonList` - List item skeletons

**Loading State Pattern**:

```tsx
import {
  SkeletonBox,
  SkeletonCard,
  SkeletonText,
} from "@/components/ui/SkeletonBox";

export default function MyComponent() {
  const { data, isLoading } = useMyData();

  if (isLoading) {
    return (
      <View>
        <SkeletonCard />
        <SkeletonText lines={3} />
      </View>
    );
  }

  return <Card>Actual Content</Card>;
}
```

**Common Loading Patterns**:

```tsx
// Loading for stats cards
{isLoading ? (
  <View style={styles.statsGrid}>
    {[1, 2, 3, 4].map((i) => (
      <SkeletonBox key={i} width="45%" height={100} borderRadius={12} />
    ))}
  </View>
) : (
  <StatsGrid stats={stats} />
)}

// Loading for list items
{isLoading ? (
  <SkeletonList items={5} itemHeight={60} spacing={12} />
) : (
  <FlatList data={items} renderItem={...} />
)}

// Loading for card content
{isLoading ? (
  <SkeletonCard />
) : (
  <Card>
    <Text>{content.title}</Text>
    <Text>{content.description}</Text>
  </Card>
)}
```

**Important**:

- ✅ Use skeleton components that match the actual content shape
- ✅ Use `SkeletonCard` for card loading states
- ✅ Use `SkeletonText` for text content loading
- ✅ Match skeleton dimensions to actual content
- ❌ Never use `ActivityIndicator` for content loading (only for button/action loading)
- ❌ Never create custom loading animations - use SkeletonBox components

---

### 🔔 Alert Modals

**ALWAYS use `AlertModalContext` instead of React Native's `Alert.alert`.**

**Location**: `apps/mobile/src/contexts/AlertModalContext.tsx`

**Available Methods**:

- `showAlert(options)` - Display a simple alert with OK button
- `showConfirm(options)` - Display a confirmation dialog with Cancel/Confirm buttons
- `showToast(options)` - Display a temporary toast notification

**Alert Modal Pattern**:

```tsx
import { useAlertModal } from "@/contexts/AlertModalContext";

export default function MyComponent() {
  const { showAlert, showConfirm, showToast } = useAlertModal();

  const handleError = async () => {
    await showAlert({
      title: "Error",
      message: "Something went wrong",
      variant: "error", // "success" | "warning" | "error" | "info"
      confirmLabel: "OK",
    });
  };

  const handleConfirm = async () => {
    const confirmed = await showConfirm({
      title: "Delete Item",
      message: "Are you sure you want to delete this item?",
      variant: "warning",
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
    });

    if (confirmed) {
      // User confirmed
    }
  };

  const handleSuccess = () => {
    showToast({
      title: "Success!",
      message: "Action completed successfully",
      variant: "success",
      duration: 2000, // milliseconds
    });
  };

  return (
    // Component JSX
  );
}
```

**Common Alert Patterns**:

```tsx
// Error alert
await showAlert({
  title: t("common.error"),
  message: errorMessage,
  variant: "error",
  confirmLabel: t("common.ok"),
});

// Success toast
showToast({
  title: t("common.success"),
  message: successMessage,
  variant: "success",
  duration: 2000,
});

// Confirmation dialog
const confirmed = await showConfirm({
  title: t("common.confirm"),
  message: confirmationMessage,
  variant: "warning",
  confirmLabel: t("common.confirm"),
  cancelLabel: t("common.cancel"),
});
```

**Important**:

- ✅ Always use `useAlertModal()` hook from `@/contexts/AlertModalContext`
- ✅ Use appropriate variant: "success", "warning", "error", "info"
- ✅ Use `showAlert` for simple notifications
- ✅ Use `showConfirm` when user confirmation is needed
- ✅ Use `showToast` for non-blocking temporary notifications
- ✅ Always use translation keys (`t()`) for user-facing text
- ❌ Never use `Alert.alert` from React Native
- ❌ Never hardcode alert text (always use translation keys)

---

## Part 4: Enhanced Visual Design (with Implementation)

### 🌈 Gradients

**Gradient Implementation Pattern**:

```tsx
import { LinearGradient } from "expo-linear-gradient"; // Install if needed
import { useTheme } from "@/themes";

// In component
const { colors, brand } = useTheme();

<LinearGradient
  colors={[brand.primary, brand.primary + "CC"]} // Add opacity
  start={{ x: 0, y: 0 }}
  end={{ x: 1, y: 1 }}
  style={styles.gradient}
>
  {children}
</LinearGradient>;

// In styles (using tokens for dimensions)
const makeStyles = (tokens: any, colors: any, brand: any) => ({
  gradient: {
    borderRadius: toRN(tokens.borderRadius.xl),
    padding: toRN(tokens.spacing[4]),
  },
});
```

**Pre-defined Gradient Colors** (add to theme if needed):

```tsx
// In style function
const gradientColors = [
  brand.primary,
  brand.primary + "DD", // Slightly transparent
  brand.primary + "AA",
];
```

---

### 🔮 Glassmorphism

**Glassmorphism Pattern** (semi-transparent with backdrop blur):

```tsx
import { BlurView } from "expo-blur"; // Install if needed
import { useTheme } from "@/themes";

const { colors } = useTheme();

<BlurView
  intensity={20}
  tint="light" // or "dark" based on theme
  style={styles.glassContainer}
>
  {children}
</BlurView>;

// Or manual implementation with opacity
const makeStyles = (tokens: any, colors: any, brand: any) => ({
  glassContainer: {
    backgroundColor: colors.bg.card + "80", // 50% opacity (hex: 80)
    borderRadius: toRN(tokens.borderRadius.xl),
    padding: toRN(tokens.spacing[4]),
    borderWidth: 1,
    borderColor: colors.border.default + "40", // 25% opacity
  },
});
```

---

### ⬆️ Elevation & Depth

**Using Shadow Presets**:

```tsx
const makeStyles = (tokens: any, colors: any, brand: any) => ({
  // Subtle elevation
  subtle: {
    shadowColor: colors.shadow.sm,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    shadowOpacity: 0.08,
    elevation: 2,
  },

  // Medium elevation
  medium: {
    shadowColor: colors.shadow.md,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    shadowOpacity: 0.12,
    elevation: 4,
  },

  // High elevation
  high: {
    shadowColor: colors.shadow.lg,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 18,
    shadowOpacity: 0.16,
    elevation: 6,
  },
});
```

**Best Practice**: Use Card component with shadow prop instead of manual shadows.

---

### ⚡ Micro-interactions

**Animation Pattern** (using theme-aware values):

```tsx
import { Animated } from 'react-native';
import { useTheme } from '@/themes';

const scaleAnim = new Animated.Value(1);

const handlePressIn = () => {
  Animated.spring(scaleAnim, {
    toValue: 0.95,
    useNativeDriver: true,
  }).start();
};

const handlePressOut = () => {
  Animated.spring(scaleAnim, {
    toValue: 1,
    useNativeDriver: true,
  }).start();
};

<TouchableOpacity
  onPressIn={handlePressIn}
  onPressOut={handlePressOut}
  style={[
    styles.button,
    {
      transform: [{ scale: scaleAnim }],
    },
  ]}
>
```

**Duration Tokens** (add to tokens.ts if needed):

```tsx
tokens.animation = {
  fast: 150,
  normal: 250,
  slow: 350,
};
```

---

## Part 5: Screen Implementation Patterns

### 📱 Onboarding Screen Pattern

```tsx
import React from "react";
import { View, Text, ScrollView } from "react-native";
import { useStyles } from "@/themes";
import { useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { Card } from "@/components/ui/Card";

export default function OnboardingScreen() {
  const styles = useStyles(makeOnboardingScreenStyles);
  const { colors, brand } = useTheme();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      <Text style={styles.title}>Welcome to FitNudge</Text>
      <Text style={styles.subtitle}>
        Your AI-powered fitness motivation companion
      </Text>

      <Card shadow="lg" style={styles.featureCard}>
        <Text style={styles.featureTitle}>AI Motivation</Text>
        <Text style={styles.featureDescription}>
          Get personalized motivational messages
        </Text>
      </Card>
    </ScrollView>
  );
}

const makeOnboardingScreenStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas,
  },
  contentContainer: {
    padding: toRN(tokens.spacing[4]),
    paddingTop: toRN(tokens.spacing[8]),
  },
  title: {
    fontSize: toRN(tokens.typography.fontSize["4xl"]),
    fontfamily: fontFamily.bold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[2]),
    textAlign: "center",
  },
  subtitle: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontfamily: fontFamily.normal,
    color: colors.text.secondary,
    marginBottom: toRN(tokens.spacing[8]),
    textAlign: "center",
  },
  featureCard: {
    marginBottom: toRN(tokens.spacing[4]),
  },
  featureTitle: {
    fontSize: toRN(tokens.typography.fontSize.xl),
    fontFamily: fontFamily.bold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[1]),
  },
  featureDescription: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
  },
});
```

---

### 🏠 Dashboard/Home Screen Pattern

```tsx
import React from "react";
import { View, Text, ScrollView, FlatList } from "react-native";
import { useStyles } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { Card } from "@/components/ui/Card";

export default function DashboardScreen() {
  const styles = useStyles(makeDashboardScreenStyles);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Good Morning!</Text>
        <Text style={styles.date}>Today's Progress</Text>
      </View>

      <View style={styles.statsContainer}>
        <Card shadow="md" style={styles.statCard}>
          <Text style={styles.statValue}>7</Text>
          <Text style={styles.statLabel}>Day Streak</Text>
        </Card>

        <Card shadow="md" style={styles.statCard}>
          <Text style={styles.statValue}>12</Text>
          <Text style={styles.statLabel}>Workouts</Text>
        </Card>
      </View>
    </ScrollView>
  );
}

const makeDashboardScreenStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas,
  },
  header: {
    padding: toRN(tokens.spacing[4]),
    paddingTop: toRN(tokens.spacing[6]),
  },
  greeting: {
    fontSize: toRN(tokens.typography.fontSize["3xl"]),
    fontFamily: fontFamily.bold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[1]),
  },
  date: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
  },
  statsContainer: {
    flexDirection: "row",
    gap: toRN(tokens.spacing[3]),
    paddingHorizontal: toRN(tokens.spacing[4]),
    marginBottom: toRN(tokens.spacing[4]),
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    padding: toRN(tokens.spacing[4]),
  },
  statValue: {
    fontSize: toRN(tokens.typography.fontSize["3xl"]),
    fontFamily: fontFamily.bold,
    color: brand.primary,
    marginBottom: toRN(tokens.spacing[1]),
  },
  statLabel: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium
    color: colors.text.secondary,
  },
});
```

---

### 📰 Feed Screen Pattern

```tsx
import React from "react";
import { View, Text, FlatList } from "react-native";
import { useStyles } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { Card } from "@/components/ui/Card";

interface FeedItem {
  id: string;
  title: string;
  content: string;
}

export default function FeedScreen() {
  const styles = useStyles(makeFeedScreenStyles);
  const feedData: FeedItem[] = []; // Your data

  const renderItem = ({ item }: { item: FeedItem }) => (
    <Card shadow="md" style={styles.feedCard}>
      <Text style={styles.feedTitle}>{item.title}</Text>
      <Text style={styles.feedContent}>{item.content}</Text>
    </Card>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={feedData}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const makeFeedScreenStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas,
  },
  listContent: {
    padding: toRN(tokens.spacing[4]),
    gap: toRN(tokens.spacing[4]),
  },
  feedCard: {
    marginBottom: toRN(tokens.spacing[3]),
  },
  feedTitle: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.bold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[2]),
  },
  feedContent: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    lineHeight: toRN(tokens.typography.fontSize.base) * 1.5,
  },
});
```

---

## Part 6: Code Quality & Validation

### ❌ Common Mistakes

**Mistake 1: Hardcoded Colors**

```tsx
// ❌ WRONG
backgroundColor: "#2563eb";

// ✅ CORRECT
backgroundColor: brand.primary;
```

**Mistake 2: Missing toRN() Converter**

```tsx
// ❌ WRONG
padding: tokens.spacing[4]; // Returns "1rem" string

// ✅ CORRECT
padding: toRN(tokens.spacing[4]); // Returns 16 (number)
```

**Mistake 3: Using StyleSheet.create Instead of useStyles**

```tsx
// ❌ WRONG
import { StyleSheet } from 'react-native';
const styles = StyleSheet.create({...});

// ✅ CORRECT
const styles = useStyles(makeComponentStyles);
```

**Mistake 4: Accessing Colors from tokens.colors Instead of useTheme**

```tsx
// ❌ WRONG
import { tokens } from "@/themes/tokens";
backgroundColor: tokens.colors.light.primary; // Doesn't adapt to dark mode

// ✅ CORRECT
const { colors } = useTheme();
backgroundColor: colors.bg.canvas; // Adapts to theme
```

**Mistake 5: Mixing Token and Hardcoded Values**

```tsx
// ❌ WRONG
{
  padding: toRN(tokens.spacing[4]),
  margin: 20  // Hardcoded!
}

// ✅ CORRECT
{
  padding: toRN(tokens.spacing[4]),
  margin: toRN(tokens.spacing[5])
}
```

**Mistake 6: Using ActivityIndicator for Content Loading States**

```tsx
// ❌ WRONG
{
  isLoading && <ActivityIndicator />;
}

// ✅ CORRECT
import { SkeletonCard, SkeletonText } from "@/components/ui/SkeletonBox";
{
  isLoading ? <SkeletonCard /> : <Card>Content</Card>;
}
```

**Mistake 7: Using Alert.alert Instead of AlertModalContext**

```tsx
// ❌ WRONG
import { Alert } from "react-native";
Alert.alert("Title", "Message");

// ✅ CORRECT
import { useAlertModal } from "@/contexts/AlertModalContext";

const { showAlert } = useAlertModal();
await showAlert({
  title: "Title",
  message: "Message",
  variant: "error", // or "success", "warning", "info"
  confirmLabel: "OK",
});
```

---

### ✅ Validation Checklist

Before submitting any component, verify:

- [ ] **Imports**: All required imports present (`useStyles`, `useTheme`, `tokens`, `toRN`)
- [ ] **Hook Usage**: `useStyles(makeComponentStyles)` called at top of component
- [ ] **Style Function**: `makeComponentStyles` follows exact signature `(tokens: any, colors: any, brand: any)`
- [ ] **Colors**: All colors accessed via `colors.*` or `brand.*` from useTheme()
- [ ] **Spacing**: All spacing uses `toRN(tokens.spacing[*])`
- [ ] **Typography**: All font sizes use `toRN(tokens.typography.fontSize.*)`
- [ ] **Border Radius**: All border radius uses `toRN(tokens.borderRadius.*)`
- [ ] **No Hardcoding**: No hardcoded colors, spacing, or sizes
- [ ] **Theme Aware**: Component adapts to light/dark mode
- [ ] **Loading States**: Uses SkeletonBox components for loading states (not ActivityIndicator)
- [ ] **Alerts**: Uses `AlertModalContext` (`useAlertModal`) instead of `Alert.alert` from React Native
- [ ] **Consistent Patterns**: Follows existing component patterns in codebase

---

### 🔍 Linter Rules

**Important ESLint/TypeScript Considerations**:

1. **Type Safety**: Consider adding proper types instead of `any`:

   ```tsx
   import type { Tokens } from '@/themes/tokens';
   import type { SemanticColors } from '@/themes/semanticColors';
   import type { BrandColors } from '@/themes/brandVariants';

   const makeStyles = (
     tokens: Tokens,
     colors: SemanticColors,
     brand: BrandColors
   ) => ({...});
   ```

2. **Unused Variables**: Remove unused imports and variables

3. **Accessibility**: Add accessibility props where needed:
   ```tsx
   <TouchableOpacity
     accessible={true}
     accessibilityLabel="Button label"
     accessibilityRole="button"
   >
   ```

---

### 🧪 Testing Patterns

**Testing Theme-Aware Components**:

```tsx
import { render } from "@testing-library/react-native";
import { ThemeProvider } from "@/themes";

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

test("component adapts to dark mode", () => {
  const { getByTestId } = renderWithTheme(<MyComponent />);
  // Test assertions
});
```

---

## Quick Reference Card

### Required Imports

```tsx
import { useStyles } from "@/themes";
import { useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import {
  SkeletonBox,
  SkeletonCard,
  SkeletonText,
} from "@/components/ui/SkeletonBox"; // For loading states
import { useAlertModal } from "@/contexts/AlertModalContext"; // For alerts (instead of Alert.alert)
```

### Component Structure

```tsx
export default function Component() {
  const styles = useStyles(makeComponentStyles);
  const { colors, brand } = useTheme();
  // ... component logic
}

const makeComponentStyles = (tokens: any, colors: any, brand: any) => ({
  // ... styles
});
```

### Common Patterns

- **Padding**: `padding: toRN(tokens.spacing[4])`
- **Margin**: `margin: toRN(tokens.spacing[6])`
- **Font Size**: `fontSize: toRN(tokens.typography.fontSize.xl)`
- **Border Radius**: `borderRadius: toRN(tokens.borderRadius.xl)`
- **Background**: `backgroundColor: colors.bg.card`
- **Text Color**: `color: colors.text.primary`
- **Brand Color**: `backgroundColor: brand.primary`
- **Loading State**: `{isLoading ? <SkeletonCard /> : <Card>Content</Card>}`

---

## Summary

This design system ensures:

- ✅ Consistent theming across all components
- ✅ Automatic light/dark mode support
- ✅ Maintainable token-based architecture
- ✅ Type-safe styling patterns
- ✅ Easy theme customization
- ✅ Performance optimized (memoized styles)

**Remember**: When in doubt, reference existing components like `Card.tsx` or `AvailableTimeScreen.tsx` for examples of correct patterns.

---

_Last Updated: [Current Date]_
_Version: 1.0.0_
