import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/fraunces";
import "@fontsource/jetbrains-mono/400.css";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "Kanchan · MCX Gold Ten Price",
  description: "The MCX Gold Ten futures price per 10 g, exactly as the exchange quotes it, without GST.",
};

export const viewport: Viewport = {
  themeColor: "#FAF3F5",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN">
      <body>
        <a href="#price" className="sr-only z-50 rounded-full bg-charcoal px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
