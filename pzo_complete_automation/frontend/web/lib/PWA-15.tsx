import * as workboxBuild from 'workbox-build';

workboxBuild.setConfig({
sourcedir: './frontend/web',
outdir: './dist',
globPatterns: [
'**/*',
// Exclude files and directories to prevent them from being cluttered in the output directory.
'!**/node_modules/**',
'!**/tests/**'
],
swSrc: './frontend/web/sw.js',
swDest: './dist/service-worker.js'
});

workboxBuild.generateSW({
clientsClaim: true,
skipWaiting: true,
navigateFallback: 'index.html',
runtimeCaching: [
{
urlPattern: /^https:\/\/[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\/.*$/,
handler: 'NetworkFirst'
}
]
});
