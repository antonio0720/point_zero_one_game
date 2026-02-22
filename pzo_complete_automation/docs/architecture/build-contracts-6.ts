// tsconfig.json
{
"compilerOptions": {
"target": "es5",
"module": "commonjs",
"strict": true,
"eslint": true,
"skipLibCheck": true,
"forceConsistentCasingInFileNames": true,
"noUnusedLocals": true,
"noImplicitReturns": true,
"noFallthroughCasesInSwitch": true,
"sourceMap": true,
"outDir": "./dist",
"composite": true,
"declaration": true,
"lib": ["es6"]
},
"include": ["src/**/*"],
"exclude": ["node_modules"]
}

// build-contracts.json (for Lerna)
{
"npmClient": "yarn",
"version": "1.1.0",
"scripts": {
"build": "tsc"
}
}
