```tsx
import React from 'react';
import Head from 'next/head';
import { useManifest } from 'next-manifest';
import { Offline } from 'offlineplugin/runtime';

const PWA10 = () => {
const manifest = useManifest();

return (
<>
<Offline fallback={<div>Sorry, this site is currently offline.</div>} />
<Head>
<link rel="manifest" href="/manifest.json" />
{Object.entries(manifest).map(([key, value]) => (
<meta key={key} name={key} content={value} />
))}
</Head>
{/* Your content here */}
</>
);
};

export default PWA10;
```

Make sure you have the `next`, `offlineplugin/next`, and `next-manifest` packages installed in your Next.js project:

```bash
npm install next offlineplugin/next next-manifest
```

Don't forget to create a `manifest.json` file for your PWA:

```json
{
"name": "Your PWA Name",
"short_name": "PWA10",
"start_url": "/",
"display": "standalone",
"background_color": "#ffffff",
"theme_color": "#000000",
"icons": [
{
"src": "/icon-72x72.png",
"sizes": "72x72",
"type": "image/png"
},
{
"src": "/icon-96x96.png",
"sizes": "96x96",
"type": "image/png"
},
{
"src": "/icon-128x128.png",
"sizes": "128x128",
"type": "image/png"
},
{
"src": "/icon-192x192.png",
"sizes": "192x192",
"type": "image/png"
},
{
"src": "/icon-512x512.png",
"sizes": "512x512",
"type": "image/png"
}
]
}
```
