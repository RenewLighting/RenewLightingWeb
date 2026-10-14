// Shared site identity used for metadata, structured data, robots.txt and the sitemap,
// so the company name/address/contact info only needs to be edited in one place.
export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://renewlighting.com").replace(/\/$/, "");

export const siteName = "Renew Lighting Services";

export const siteDescription =
  "Serving Commercial, Industrial, and Multifamily Properties across California. Over 30 years of trusted experience in electrical and lighting solutions.";

export const logoUrl = `${siteUrl}/logo-fixed-closer-transparent.svg`;

export const contact = {
  telephone: "+1-909-925-1000",
  email: "operations@renewlighting.com",
  streetAddress: "673 E Cooley Dr., Suite 108",
  addressLocality: "Colton",
  addressRegion: "CA",
  postalCode: "92324",
  addressCountry: "US",
};

export const foundingYear = "1994";

export const areasServed = [
  "Greater Los Angeles",
  "Orange County",
  "San Francisco Bay Area",
  "San Diego & Desert",
];
