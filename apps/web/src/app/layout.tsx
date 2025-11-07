import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import "@/styles/globals.css";
import "@/lib/i18n"; // Initialize i18n

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  style: ["normal", "italic"],
  variable: "--font-nunito",
  display: "swap",
});

export const metadata: Metadata = {
  title:
    "FitNudge - AI-Powered Fitness Motivation | Transform Your Fitness Journey",
  description:
    "Transform your fitness journey with AI-powered motivation, personalized coaching, and smart goal tracking. Join 50,000+ users achieving their fitness dreams with FitNudge.",
  keywords:
    "fitness app, AI coach, fitness motivation, workout tracker, fitness goals, health app, personal trainer, fitness community",
  authors: [{ name: "FitNudge Team" }],
  creator: "FitNudge",
  publisher: "FitNudge",
  robots: "index, follow",
  openGraph: {
    title: "FitNudge - AI-Powered Fitness Motivation",
    description:
      "Transform your fitness journey with AI-powered motivation and personalized coaching",
    url: "https://fitnudge.app",
    siteName: "FitNudge",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "FitNudge - AI-Powered Fitness Motivation",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "FitNudge - AI-Powered Fitness Motivation",
    description:
      "Transform your fitness journey with AI-powered motivation and personalized coaching",
    images: ["/og-image.jpg"],
  },
  other: {
    "apple-itunes-app": "app-id=XXXXXXXXXX",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#111827" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`scroll-smooth ${nunito.variable}`}>
      <body className={`antialiased w-full font-sans ${nunito.className}`}>
        {children}
      </body>
    </html>
  );
}
