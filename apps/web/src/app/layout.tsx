import type { Metadata } from "next";
import localFont from "next/font/local";
import "@/styles/globals.css";
import "@/lib/i18n"; // Initialize i18n

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
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
  viewport: "width=device-width, initial-scale=1",
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
    <html lang="en" className="scroll-smooth">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased w-full`}
      >
        {children}
      </body>
    </html>
  );
}
