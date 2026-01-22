/* eslint-disable no-undef */
/** @type {import('next-sitemap').IConfig} */
const config = {
  siteUrl: process.env.NEXT_PUBLIC_BASE_URL || "https://fitnudge.app",
  generateRobotsTxt: true,
  changefreq: "daily",
  sitemapSize: 7000,
  exclude: ["/api/*", "/404", "/500"],
};

export default config;
