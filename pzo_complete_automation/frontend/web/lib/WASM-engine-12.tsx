```bash
frontend/
|-- node_modules/
|-- src/
|   |-- components/
|   |   |-- WasmComponent.tsx
|   |-- index.tsx
|   |-- serviceWorkerRegistration.ts
|-- web/
|   |-- build/
|   |-- lib/
|       |-- WASM-engine-12.wasm
|-- package.json
```

```typescript
// src/components/WasmComponent.tsx
import * as wasm from './WASM-engine-12';

const wasmModule = await wasm.instantiateAsync(wasm.module);
const wasmInstance = wasmModule.instance;

// Call WASM functions as needed

export default function WasmComponent() {
// React Component code
}
```

```typescript
// src/index.tsx
import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';
import WasmComponent from './components/WasmComponent';

ReactDOM.render(
<>
<App />
<WasmComponent />
</>,
document.getElementById('root')
);

// If you want your app to work offline and load faster, you can change
// unregister onBeforeInstallPrompt to call preventInstallPrompt instead.
// Learn more about the install and application cache: https://bit.ly/CRA-PWA
serviceWorkerRegistration.unregister();
```

```typescript
// src/serviceWorkerRegistration.ts
self as any; // eslint-disable-line no-self-assign, no-this-before-super

if ('serviceWorker' in navigator) {
window.addEventListener('load', () => {
const swReg = navigator.serviceWorker.register('./service-worker.js');
swReg.then(registration => {
// Registration was successful
console.log('ServiceWorker registration successful with scope: ', registration.scope);
});
});
}
```

In the `package.json`, you should have a script for compiling your TypeScript files and another one for building the WebAssembly module, like this:

```json
"scripts": {
"start": "react-scripts start",
"build": "react-scripts build",
"wasm-compile": "emscripten cc -O3 -s WASM_EXPORT_NAME='__wbindgen_cpp_entrypoint' -o lib/WASM-engine-12.js -I ./src src/components/WASM-engine-12.c"
}
```
