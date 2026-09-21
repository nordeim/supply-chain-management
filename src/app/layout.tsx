import type { Metadata } from "next";
import { Hanken_Grotesk, Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { AppShell } from "@/components/app/app-shell";
import { getSessionUser } from "@/lib/session";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// The reference app renders its numeric cells (qty, costs, dates) in
// Hanken Grotesk 300 — loaded here and mapped to the `font-numeric` utility.
const hankenGrotesk = Hanken_Grotesk({
  variable: "--font-hanken-grotesk",
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Supply Chain Management",
  description:
    "Inventory intelligence dashboard — live stock levels, AI replenishment suggestions, procurement, suppliers, and market trends in one control room.",
  keywords: ["supply chain", "inventory", "procurement", "replenishment", "dashboard"],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getSessionUser();
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${hankenGrotesk.variable} font-sans antialiased bg-background text-foreground`}>
        <AppShell user={user}>{children}</AppShell>
        <Toaster />
      </body>
    </html>
  );
}
