import React from 'react';
import Head from 'next/head';

const Pwa20 = () => {
return (
<div>
<Head>
<meta name="mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="application-name" content="PWA-20" />
<meta name="theme-color" content="#007bff" />
<link rel="manifest" href="/manifest.json" />
</Head>

{/* Your content goes here */}
</div>
);
};

export default Pwa20;
