// tsconfig.json
{
"compilerOptions": {
"module": "CommonJS",
"target": "ES2018",
"strict": true,
"eslintPath": "./node_modules/.bin/eslint"
},
"include": ["src"]
}

// package.json
{
"name": "your-project",
"version": "1.0.0",
"dependencies": {
"@types/eslint-plugin-security": "^4.2.0",
"eslint": "^7.32.0",
"eslint-config-airbnb-base": "^15.0.0",
"eslint-config-prettier": "^8.3.0",
"eslint-plugin-import": "^2.26.0",
"eslint-plugin-node": "^12.0.0",
"eslint-plugin-react": "^7.25.1",
"eslint-plugin-security": "^4.2.0"
},
"scripts": {
"lint": "eslint --ext .ts,.tsx src"
}
}

// .eslintrc.json
{
"extends": [
"airbnb-base",
"prettier",
"plugin:security/recommended",
"plugin:react/recommended",
"plugin:import/errors",
"plugin:import/warnings",
"plugin:node/recommended"
],
"rules": {
// You can override rules here if necessary
}
}
