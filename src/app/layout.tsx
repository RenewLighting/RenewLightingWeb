import type { Metadata } from "next";
import { Manrope, Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import OrganizationJsonLd from "@/components/OrganizationJsonLd";
import { siteDescription, siteName, siteUrl } from "@/lib/site";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const title = "Renew Lighting Services | Electrical and Lighting";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: `%s | ${siteName}`,
  },
  description: siteDescription,
  keywords: [
    "commercial lighting contractor",
    "commercial electrical contractor California",
    "industrial lighting services",
    "multifamily property electrical",
    "LED retrofit contractor",
    "Renew Lighting Services",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName,
    title,
    description: siteDescription,
  },
  twitter: {
    card: "summary_large_image",
    title,
    description: siteDescription,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${inter.variable} scroll-smooth`}
    >
      <head>
        <link rel="icon" href="/logo-fixed-closer-transparent.svg" type="image/svg+xml" />
        <OrganizationJsonLd />
      </head>
      <body className="bg-surface font-body text-on-surface">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
