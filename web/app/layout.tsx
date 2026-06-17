import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const TITLE = "BludStack - The fastest way to find a blood donor";
const DESCRIPTION =
  "A free, real-time blood donation network. Post a request in seconds and the nearest compatible donors are alerted instantly. Watch a donor arrive live on the map, like Uber for the most important ride of someone's life.";

export const metadata: Metadata = {
  metadataBase: new URL("https://bludstack.app"),
  title: { default: TITLE, template: "%s - BludStack" },
  description: DESCRIPTION,
  applicationName: "BludStack",
  keywords: [
    "blood donation",
    "blood donor app",
    "find blood donor",
    "blood request",
    "donate blood",
    "emergency blood",
    "real-time donor matching",
  ],
  authors: [{ name: "Aashir Athar" }],
  openGraph: {
    type: "website",
    title: TITLE,
    description: DESCRIPTION,
    siteName: "BludStack",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  icons: { icon: "/favicon.ico" },
};

export const viewport: Viewport = {
  themeColor: "#0a0910",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-[100dvh] overflow-x-hidden flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
