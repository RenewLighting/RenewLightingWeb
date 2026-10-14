import {
  areasServed,
  contact,
  foundingYear,
  logoUrl,
  siteDescription,
  siteName,
  siteUrl,
} from "@/lib/site";

// Tells Google "this logo belongs to this business name/site" — the documented way to get
// a company logo to show up next to the brand name in Search and the Knowledge Panel.
// See https://developers.google.com/search/docs/appearance/structured-data/logo
export default function OrganizationJsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["LocalBusiness", "Electrician"],
        "@id": `${siteUrl}/#organization`,
        name: siteName,
        alternateName: "Renew Lighting",
        url: siteUrl,
        logo: logoUrl,
        image: logoUrl,
        description: siteDescription,
        telephone: contact.telephone,
        email: contact.email,
        foundingDate: foundingYear,
        priceRange: "$$",
        address: {
          "@type": "PostalAddress",
          streetAddress: contact.streetAddress,
          addressLocality: contact.addressLocality,
          addressRegion: contact.addressRegion,
          postalCode: contact.postalCode,
          addressCountry: contact.addressCountry,
        },
        areaServed: areasServed.map((name) => ({ "@type": "AdministrativeArea", name })),
        // Add official social profile URLs here (e.g. LinkedIn, Facebook) once available —
        // Google uses `sameAs` to confirm which profiles belong to this business.
        sameAs: [] as string[],
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        name: siteName,
        url: siteUrl,
        publisher: { "@id": `${siteUrl}/#organization` },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      // JSON-LD is data, not executable script, so a plain <script> tag is correct here.
      // Escaping "<" prevents a malicious value from breaking out of the script tag.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
    />
  );
}
