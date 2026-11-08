import type { Metadata } from "next";
import { Archivo, Bricolage_Grotesque, Fraunces, Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";
import { ThemePreview } from "@/components/theme-preview";
import "./globals.css";

// Theme exploration faces (design/theme-options): one per option.
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], axes: ["opsz"] });
const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"] });
const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"], axes: ["wdth"] });

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
      className={`${jakarta.variable} ${geistMono.variable} ${fraunces.variable} ${bricolage.variable} ${archivo.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Above both route groups so a toast fired just before a navigation survives it. */}
        <ToastProvider>{children}</ToastProvider>
        {process.env.NODE_ENV !== "production" && <ThemePreview />}
      </body>
    </html>
  );
}
