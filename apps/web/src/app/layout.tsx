import type { Metadata } from "next";
import { Fraunces, Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";
import { THEME_SCRIPT } from "@/lib/theme";
import "./globals.css";

// Display serif for large headings only (the .display class).
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], axes: ["opsz"] });

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  description:
    "Keep your customer list and send email campaigns to the people who asked to hear from you.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${jakarta.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
      // THEME_SCRIPT sets data-theme before React hydrates.
      suppressHydrationWarning
      // Lets Next turn smooth scrolling off during route changes, so page navigations stay instant.
      data-scroll-behavior="smooth"
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        {/* Above both route groups so a toast fired just before a navigation survives it. */}
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
