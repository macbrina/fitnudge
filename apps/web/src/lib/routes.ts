// Centralized routes management for the web app
export const ROUTES = {
  // Main navigation
  HOME: "/",
  FEATURES: "/#features",
  PRICING: "/#pricing",
  BLOG: "/blog",
  HOW_IT_WORKS: "/#how-it-works",

  CONTACT: "/contact-us",
  DOWNLOAD: "/#download",

  // Footer links
  FAQS: "/faqs",
  PRIVACY: "/privacy-policy",
  COOKIES: "/cookie-policy",
  TERMS: "/terms-of-service",
  WHY_FITNUDGE: "/why-fitnudge",
  ABOUT: "/about-us",

  // App download links
  APP_STORE: "https://apps.apple.com/app/fitnudge",
  GOOGLE_PLAY: "https://play.google.com/store/apps/details?id=com.fitnudge.app",

  // Social links
  TWITTER: "https://twitter.com/fitnudge",
  INSTAGRAM: "https://instagram.com/fitnudge",
  FACEBOOK: "https://facebook.com/fitnudge",
  LINKEDIN: "https://linkedin.com/company/fitnudge",
} as const;

export type RouteKey = keyof typeof ROUTES;
