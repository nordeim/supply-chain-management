import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { AppShell } from "@/components/app/app-shell";
import { getSessionUser } from "@/lib/session";

const inter = Inter({
  variable: "--font-inter",
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
      <body className={`${inter.variable} font-sans antialiased bg-background text-foreground`}>
        <AppShell user={user}>{children}</AppShell>
        <Toaster />
      </body>
    </html>
  );
}
