import type { Metadata } from "next";
import "../lib/i18n"; // Initialize i18n

export const metadata: Metadata = {
  title: "FitNudge Admin Portal",
  description: "Admin dashboard for FitNudge fitness app",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
