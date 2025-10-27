# @chopup/assets

Shared assets package for ChopUp applications.

## Fonts

This package includes the following font families:

### SpaceGrotesk

- `SpaceGrotesk-Regular`
- `SpaceGrotesk-Medium`
- `SpaceGrotesk-SemiBold`
- `SpaceGrotesk-Bold`

### Alegreya

- `Alegreya-Regular`
- `Alegreya-Medium`
- `Alegreya-SemiBold`
- `Alegreya-Bold`

### Nunito

- `Nunito-Regular`
- `Nunito-Medium`
- `Nunito-SemiBold`
- `Nunito-Bold`

## Usage

### In Utils Package

```typescript
import { fontFamilyNames } from "@chopup/assets";
import { useFonts } from "expo-font";

export const useAppFonts = () => {
  const [fontsLoaded] = useFonts(fontFamilyNames);
  return fontsLoaded;
};
```

### Direct Import

```typescript
import { fonts } from "@fitnudge/assets";

// Access specific fonts
const spacegrotekRegular = fonts.spacegrotesk.regular;
const nunitoBold = fonts.nunito.bold;
```

## Installation

This package is automatically included in the workspace. No additional installation is required.

## Structure

```
packages/assets/
├── fonts/           # Font files (.ttf)
├── images/          # Shared images
├── index.ts         # Main exports
├── package.json     # Package configuration
├── tsconfig.json    # TypeScript configuration
└── README.md        # This file
```
