```tsx
import React from 'react';
import { Helmet } from 'react-helmet';
import './PWA-14.css';

const Pwa14 = () => {
return (
<div>
<Helmet>
<title>PWA-14</title>
<link rel="manifest" href="/manifest.json" />
<meta name="theme-color" content="#007bff" />
<meta name="mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<link rel="apple-touch-icon" href="/logo192.png" />
</Helmet>
{/* Your app content goes here */}
</div>
);
};

export default Pwa14;
```

In this example, the `Pwa14` component sets up the necessary meta tags and links for a PWA. The `Helmet` component is used to manage the document head in React. The title, manifest file link, theme color, mobile web app capability, apple mobile web app capability, and apple touch icon are set here.

```sh
"react": "^17.0.2",
"react-helmet": "^6.2.0"
```

Also, make sure you have a `manifest.json`, an `icon192.png`, and any other required assets in your project directory for the PWA to function correctly.
