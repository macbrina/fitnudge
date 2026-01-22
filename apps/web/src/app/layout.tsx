import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import Script from "next/script";
import "@/styles/globals.css";
import "@/lib/i18n"; // Initialize i18n
import GoogleAnalyticsWrapper from "@/components/GoogleAnalyticsWrapper";
import { Providers } from "@/components/providers/Providers";
import NextTopLoader from "nextjs-toploader";

const GTM_ID = "GTM-W9GDWPLL";

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  style: ["normal", "italic"],
  variable: "--font-nunito",
  display: "swap",
});

// Site configuration
const siteConfig = {
  name: "FitNudge",
  title: "FitNudge - AI Accountability Partner | Build Lasting Habits",
  description:
    "Build lasting habits with AI-powered accountability, personalized motivation, and smart goal tracking. Your daily nudge for any goal - fitness, reading, meditation, learning, or anything else.",
  url: process.env.NEXT_PUBLIC_BASE_URL || "https://fitnudge.app",
  ogImage: `${process.env.NEXT_PUBLIC_BASE_URL || "https://fitnudge.app"}/og-image.jpg`,
  twitterHandle: "@fitnudgeapp",
  locale: "en_US",
  // App Store URLs
  iosAppStoreUrl:
    process.env.NEXT_PUBLIC_IOS_APP_STORE_URL ||
    "https://apps.apple.com/app/fitnudge/id123456789",
  iosAppStoreId: process.env.NEXT_PUBLIC_IOS_APP_STORE_ID || "123456789",
  androidPackage: process.env.NEXT_PUBLIC_ANDROID_PACKAGE || "com.fitnudge.app",
  androidPlayStoreUrl:
    process.env.NEXT_PUBLIC_ANDROID_PLAY_STORE_URL ||
    "https://play.google.com/store/apps/details?id=com.fitnudge.app",
};

export const metadata: Metadata = {
  // Basic metadata
  title: {
    default: siteConfig.title,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: [
    "habit tracker",
    "AI coach",
    "goal tracking",
    "accountability app",
    "habit building",
    "personal development",
    "motivation app",
    "streak tracker",
    "fitness tracker",
    "daily habits",
    "goal setting",
    "self improvement",
    "productivity app",
    "wellness app",
  ],

  // Authorship
  authors: [{ name: "FitNudge Team", url: siteConfig.url }],
  creator: siteConfig.name,
  publisher: siteConfig.name,

  // Canonical URL
  metadataBase: new URL(siteConfig.url),
  alternates: {
    canonical: "/",
    languages: {
      "en-US": "/",
      "es-ES": "/es",
      "fr-FR": "/fr",
      "de-DE": "/de",
      "it-IT": "/it",
      "pt-PT": "/pt",
      "nl-NL": "/nl",
    },
  },

  // Robots
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  // Icons
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    other: [
      {
        rel: "mask-icon",
        url: "/safari-pinned-tab.svg",
        color: "#2563eb",
      },
    ],
  },

  // Manifest
  manifest: "/site.webmanifest",

  // Open Graph
  openGraph: {
    type: "website",
    locale: siteConfig.locale,
    url: siteConfig.url,
    siteName: siteConfig.name,
    title: siteConfig.title,
    description: siteConfig.description,
    images: [
      {
        url: siteConfig.ogImage,
        width: 1200,
        height: 630,
        alt: `${siteConfig.name} - AI Accountability Partner`,
        type: "image/jpeg",
      },
      {
        url: `${siteConfig.url}/og-image-square.jpg`,
        width: 600,
        height: 600,
        alt: `${siteConfig.name} Logo`,
        type: "image/jpeg",
      },
    ],
  },

  // Twitter
  twitter: {
    card: "summary_large_image",
    site: siteConfig.twitterHandle,
    creator: siteConfig.twitterHandle,
    title: siteConfig.title,
    description: siteConfig.description,
    images: {
      url: siteConfig.ogImage,
      alt: `${siteConfig.name} - AI Accountability Partner`,
    },
  },

  // App Links
  appLinks: {
    ios: {
      url: siteConfig.iosAppStoreUrl,
      app_store_id: siteConfig.iosAppStoreId,
      app_name: siteConfig.name,
    },
    android: {
      package: siteConfig.androidPackage,
      url: siteConfig.androidPlayStoreUrl,
      app_name: siteConfig.name,
    },
    web: {
      url: siteConfig.url,
      should_fallback: true,
    },
  },

  // Verification (Google uses DNS verification for domain ownership)
  verification: {
    // yandex: "your-yandex-verification-code",
    other: {
      // "msvalidate.01": "your-bing-verification-code",
      "facebook-domain-verification": "c7rubsbzt1jc51q32lr54ajc0w5zfr",
    },
  },

  // Category
  category: "Health & Fitness",

  // Classification
  classification: "Productivity, Health & Fitness, Lifestyle",

  // Other metadata
  other: {
    "apple-itunes-app": `app-id=${siteConfig.iosAppStoreId}`,
    "google-play-app": `app-id=${siteConfig.androidPackage}`,
    "msapplication-TileColor": "#2563eb",
    "msapplication-config": "/browserconfig.xml",
    "format-detection": "telephone=no",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#111827" },
  ],
  colorScheme: "light dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`scroll-smooth ${nunito.variable}`}>
      <body className={`antialiased w-full font-sans ${nunito.className}`}>
        {/* Google Tag Manager */}
        <Script
          id="gtm-script"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`,
          }}
        />
        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        <GoogleAnalyticsWrapper />
        <NextTopLoader showSpinner={false} color="#0066ff" />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
