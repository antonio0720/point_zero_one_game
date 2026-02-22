/**
 * SEO component for /host route
 * - JSON-LD schema
 * - Open Graph tags
 * - Twitter card
 * - Canonical URL: https://pointzeroonegame.com/host
 * - Keywords: financial game night, money game, host kit
 */

import React from 'react';
import { Helmet } from 'react-helmet';

const HostOSSEO = () => (
  <Helmet>
    {/* Open Graph */}
    <meta property="og:url" content="https://pointzeroonegame.com/host" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="Point Zero One Digital - Host Kit" />
    <meta property="og:description" content="Experience a 12-minute financial roguelike game. Sovereign infrastructure architect design. Production-grade, deployment-ready." />
    <meta property="og:image" content="https://pointzeroonegame.com/host-og-image.jpg" />

    {/* Twitter Card */}
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:url" content="https://pointzeroonegame.com/host" />
    <meta name="twitter:title" content="Point Zero One Digital - Host Kit" />
    <meta name="twitter:description" content="Experience a 12-minute financial roguelike game. Sovereign infrastructure architect design. Production-grade, deployment-ready." />
    <meta name="twitter:image" content="https://pointzeroonegame.com/host-og-image.jpg" />

    {/* JSON-LD */}
    <script type="application/ld+json">
      {`
        {
          "@context": "https://schema.org",
          "@type": "WebSite",
          "url": "https://pointzeroonegame.com/host",
          "potentialAction": {
            "@type": "SearchAction",
            "target": {
              "@type": "EntryPoint",
              "urlTemplate": "https://pointzeroonegame.com/search?q={search_term_string}",
              "actionPlatform": [
                "https://schema.org/DesktopWebPlatform",
                "https://schema.org/IOSPlatform",
                "https://schema.org/AndroidPlatform"
              ]
            },
            "query-input": "required name=search_term_string"
          }
        }
      `}
    </script>
  </Helmet>
);

export default HostOSSEO;
