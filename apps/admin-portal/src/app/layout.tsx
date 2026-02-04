import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import { Toaster } from "sonner";
import en from "@/locales/en.json";
import { I18nProvider } from "@/components/I18nProvider";
import { QueryProvider } from "@/components/QueryProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import { AlertModalProvider } from "@/contexts/AlertModalContext";
import "@/styles/globals.css";
import NextTopLoader from "nextjs-toploader";

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  style: ["normal", "italic"],
  variable: "--font-nunito",
  display: "swap",
});

const meta = (en as { metadata?: { title?: string; description?: string } }).metadata;
export const metadata: Metadata = {
  title: meta?.title,
  description: meta?.description,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={nunito.variable}>
      <body className={`antialiased font-sans ${nunito.className}`}>
        <NextTopLoader showSpinner={false} color="#0066ff" />
        <QueryProvider>
          <I18nProvider>
            <AuthProvider>
              <AlertModalProvider>{children}</AlertModalProvider>
            </AuthProvider>
          </I18nProvider>
        </QueryProvider>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
