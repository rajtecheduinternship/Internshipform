import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { LangProvider } from "@/components/help/i18n";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

// Keep the browser title and social sharing copy in sync as the site evolves.
const SITE_TITLE = "Rajtech | Internship & Learning Portal";
const SITE_DESCRIPTION = "Explore practical IT courses, apply for internships, and learn with Rajtech. Watch lessons, track progress, and get support in Hindi or English.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || "https://rtsinternship.vercel.app"),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  applicationName: "Rajtech",
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    siteName: "Rajtech",
    type: "website",
    url: "/",
    locale: "en_IN",
    alternateLocale: ["hi_IN"],
    images: [{
      url: "/logo.png",
      width: 278,
      height: 276,
      alt: "Rajtech Technological Systems logo",
    }],
  },
  twitter: {
    card: "summary",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [{ url: "/logo.png", alt: "Rajtech Technological Systems logo" }],
  },
  keywords: ["internship", "Rajtech", "Patliputra University", "computer training"],
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        <LangProvider>{children}</LangProvider>
      </body>
    </html>
  );
}
