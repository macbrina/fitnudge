// Shared Assets Package
// This package contains shared assets like fonts, images, etc.

// Font exports
export const fonts = {
  // Nunito Font Family
  nunito: {
    regular: require("./fonts/Nunito-Regular.ttf"),
    medium: require("./fonts/Nunito-Medium.ttf"),
    semiBold: require("./fonts/Nunito-SemiBold.ttf"),
    bold: require("./fonts/Nunito-Bold.ttf"),
    extraBold: require("./fonts/Nunito-ExtraBold.ttf"),

    regularItalic: require("./fonts/Nunito-RegularItalic.ttf"),
    mediumItalic: require("./fonts/Nunito-MediumItalic.ttf"),
    semiBoldItalic: require("./fonts/Nunito-SemiBoldItalic.ttf"),
    boldItalic: require("./fonts/Nunito-BoldItalic.ttf"),
    extraBoldItalic: require("./fonts/Nunito-ExtraBoldItalic.ttf"),
  },
  // Space Grotesk Font Family
  spaceGrotesk: {
    regular: require("./fonts/SpaceGrotesk-Regular.ttf"),
    medium: require("./fonts/SpaceGrotesk-Medium.ttf"),
    semiBold: require("./fonts/SpaceGrotesk-SemiBold.ttf"),
    bold: require("./fonts/SpaceGrotesk-Bold.ttf"),
  },
};

// Font family names for use with expo-font
export const fontFamilyNames = {
  "SpaceGrotesk-Regular": fonts.spaceGrotesk.regular,
  "SpaceGrotesk-Medium": fonts.spaceGrotesk.medium,
  "SpaceGrotesk-SemiBold": fonts.spaceGrotesk.semiBold,
  "SpaceGrotesk-Bold": fonts.spaceGrotesk.bold,
  "Nunito-Regular": fonts.nunito.regular,
  "Nunito-Medium": fonts.nunito.medium,
  "Nunito-SemiBold": fonts.nunito.semiBold,
  "Nunito-Bold": fonts.nunito.bold,
  "Nunito-RegularItalic": fonts.nunito.regularItalic,
  "Nunito-MediumItalic": fonts.nunito.mediumItalic,
  "Nunito-SemiBoldItalic": fonts.nunito.semiBoldItalic,
  "Nunito-BoldItalic": fonts.nunito.boldItalic,
  "Nunito-ExtraBold": fonts.nunito.extraBold,
  "Nunito-ExtraBoldItalic": fonts.nunito.extraBoldItalic,
};

// Default export for easy importing
export default {
  fonts,
  fontFamilyNames,
};
