// Centralized routes management for the web app
export const ROUTES = {
  // Main navigation
  HOME: "/",
  FEATURES: "/features",
  BLOG: "/blog",
  HOW_IT_WORKS: "/#how-it-works",
  CONTACT: "/contact",
  DOWNLOAD: "/#download",

  // Footer links
  PRIVACY: "/privacy-policy",
  COOKIES: "/cookie-policy",
  TERMS: "/terms-of-service",
  WHY_FITNUDGE: "/why-fitnudge",
  ABOUT: "/about-us",
  HEALTH: "/health",

  // App download links
  APP_STORE: "https://apps.apple.com/app/fitnudge",
  GOOGLE_PLAY: "https://play.google.com/store/apps/details?id=com.fitnudge.app",

  // Social links
  TWITTER: "https://twitter.com/fitnudgeapp",
  INSTAGRAM: "https://instagram.com/fitnudgeapp",
  FACEBOOK: "https://facebook.com/fitnudgeapp",
  LINKEDIN: "https://linkedin.com/company/fitnudgeapp",
  TIKTOK: "https://tiktok.com/@fitnudgeapp",
} as const;

export type RouteKey = keyof typeof ROUTES;
