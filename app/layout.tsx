import type { Metadata, Viewport } from "next";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE } from "../lib/site.ts";
import "./globals.css";

const siteUrl = new URL(
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
);

if (!['http:', 'https:'].includes(siteUrl.protocol)) {
  throw new Error("NEXT_PUBLIC_SITE_URL must use the http or https protocol");
}

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: SITE_NAME,
    locale: "vi_VN",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: { card: "summary", title: SITE_TITLE, description: SITE_DESCRIPTION },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f7fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0f141d" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body>{children}</body></html>;
}
