import * as React from 'react';
import { ServiceWorker, useServiceWorker } from 'sw-precache';

const PwaV1 = () => {
const [swReady] = useServiceWorker();

return (
<>
{swReady ? (
<div>Your content here</div>
) : (
<div>Loading...</div>
)}
<script>{`(async () => {
const sw = await new ServiceWorker('/service-worker.js', {
scope: '/'
});
})();`}</script>
</>
);
};

export default PwaV1;
