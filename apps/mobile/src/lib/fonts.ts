import { useFonts } from "expo-font";
import { fontFamilyNames } from "@fitnudge/assets";

export const useAppFonts = () => {
  const [fontsLoaded] = useFonts(fontFamilyNames);
  return fontsLoaded;
};

export const fontFamily = {
  regular: "Nunito-Regular",
  medium: "Nunito-Medium",
  semiBold: "Nunito-SemiBold",
  bold: "Nunito-Bold",
  extraBold: "Nunito-ExtraBold",
  extraBoldItalic: "Nunito-ExtraBoldItalic",
  mediumItalic: "Nunito-MediumItalic",
  regularItalic: "Nunito-RegularItalic",
  semiBoldItalic: "Nunito-SemiBoldItalic",
  boldItalic: "Nunito-BoldItalic",

  groteskRegular: "SpaceGrotesk-Regular",
  groteskMedium: "SpaceGrotesk-Medium",
  groteskSemiBold: "SpaceGrotesk-SemiBold",
  groteskBold: "SpaceGrotesk-Bold",
};

// Helper function to get font family based on weight
export const getFontFamily = (
  weight:
    | "regular"
    | "medium"
    | "semiBold"
    | "bold"
    | "extraBold"
    | "extraBoldItalic"
    | "mediumItalic"
    | "regularItalic"
    | "semiBoldItalic"
    | "boldItalic"
    | "groteskRegular"
    | "groteskMedium"
    | "groteskSemiBold"
    | "groteskBold" = "regular"
) => {
  return fontFamily[weight as keyof typeof fontFamily];
};

// Helper function to get font style object
export const getFontStyle = (
  weight:
    | "regular"
    | "medium"
    | "semiBold"
    | "bold"
    | "extraBold"
    | "extraBoldItalic"
    | "mediumItalic"
    | "regularItalic"
    | "semiBoldItalic"
    | "boldItalic"
    | "groteskRegular"
    | "groteskMedium"
    | "groteskSemiBold"
    | "groteskBold" = "regular"
) => {
  return {
    fontFamily: getFontFamily(weight as keyof typeof fontFamily),
  };
};
