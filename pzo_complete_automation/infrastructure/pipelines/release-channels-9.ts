import { defineConfig } from 'tsup';

export default defineConfig({
entry: ['src/**/*.{ts,js}'],
clean: true,
sourcemap: true,
format: ['cjs', 'esm'],
dts: true,
tsconfig: './tsconfig.json',
outDir: './dist',
ongeneratebundle: ({ filename, bundle }) => {
const channel = process.env.RELEASE_CHANNEL;
const releaseVersion = process.env.RELEASE_VERSION;

if (filename.endsWith('.js')) {
bundle = `${bundle}\n\n// Release Channel: ${channel}\n\n// Release Version: ${releaseVersion}`;
} else if (filename.endsWith('.d.ts')) {
bundle = `${bundle}\n\n/// <reference types="@types/node" />\n\n// Release Channel: ${channel}\n\n// Release Version: ${releaseVersion}`;
}

return { code: bundle };
},
});
