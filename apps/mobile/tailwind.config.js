/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
    "../../packages/ui/src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Nunito-Regular", "system-ui", "sans-serif"],
        medium: ["Nunito-Medium", "system-ui", "sans-serif"],
        semibold: ["Nunito-SemiBold", "system-ui", "sans-serif"],
        bold: ["Nunito-Bold", "system-ui", "sans-serif"],
        extraBold: ["Nunito-ExtraBold", "system-ui", "sans-serif"],

        regularItalic: ["Nunito-RegularItalic", "system-ui", "sans-serif"],
        mediumItalic: ["Nunito-MediumItalic", "system-ui", "sans-serif"],
        semiBoldItalic: ["Nunito-SemiBoldItalic", "system-ui", "sans-serif"],
        boldItalic: ["Nunito-BoldItalic", "system-ui", "sans-serif"],
        extraBoldItalic: ["Nunito-ExtraBoldItalic", "system-ui", "sans-serif"],

        groteskRegular: ["SpaceGrotesk-Regular", "system-ui", "sans-serif"],
        groteskMedium: ["SpaceGrotesk-Medium", "system-ui", "sans-serif"],
        groteskSemiBold: ["SpaceGrotesk-SemiBold", "system-ui", "sans-serif"],
        groteskBold: ["SpaceGrotesk-Bold", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
