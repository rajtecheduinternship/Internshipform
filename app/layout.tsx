import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { LangProvider } from "@/components/help/i18n";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Internship Registration - Rajtech Technological Systems",
  description: "Register for Patliputra University Internship Program at Rajtech Technological Systems",
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
