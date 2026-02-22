// tsconfig.json
{
"compilerOptions": {
//... other options
"composite": true,
"declaration": true,
"esModuleInterop": true,
"skipLibCheck": true,
"strict": true
}
}

// package.json
{
"name": "my-monorepo",
"version": "1.0.0",
"private": true,
"workspaces": {
"baseUrl": "./",
"sourceRoot": "./src",
"packages": [
"package1",
"package2",
"contracts"
]
},
//... other scripts and dependencies
}

// contracts/tsconfig.json
{
"extends": "../tsconfig.json",
"compilerOptions": {
//... other options specific to contracts
}
}

// package.json in contracts folder
{
"name": "contracts",
"version": "1.0.0",
"type": "module",
//... other scripts and dependencies specific to contracts
"main": "dist/index.js",
"types": "dist/index.d.ts"
}
