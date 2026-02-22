app.get(req.url, (_, res) => {
require.main.require(filePath)(res);
});
break;
default:
app.get(req.url, (req, res) => {
res.sendFile(path.join(__dirname, '../frontend/build', req.originalUrl));
});
}
});

// Start the server on a specified port
const PORT = process.env.PORT || 4001;
app.listen(PORT, () => {
console.log(`Server running on port ${PORT}`);
});
```

This example assumes that you have an Angular project with a React app as a sibling directory named `frontend`. The React application has been built and is located in the `frontend/build` directory. Adjust the path to your React application's build directory accordingly if it differs from this example.

To integrate this code into an existing Angular project, follow these steps:

1. Create a new file (e.g., `react-server.ts`) in your Angular project's root folder (alongside `src`, `node_modules`, and other files).
2. Paste the provided code into that file.
3. Install the dependencies using npm:
```sh
cd <your-angular-project>
npm install express cors
```
4. Update your Angular project's `tsconfig.json` file to include the newly created file in the compiler options:
```json
{
"files": [
"node_modules/@angular/**/*.d.ts",
"src/main.ts",
"react-server.ts" // Add this line
],
...
}
```
5. Run your Angular application with the following command:
```sh
ng serve --port 4200 --proxy-config proxy.conf.json
```
6. Create a `proxy.conf.js` file in the root folder of your Angular project and define the following rules to forward requests to the React server running on port 4001:

```javascript
module.exports = function(app) {
app.use('/react', require('http-proxy-middleware')({ target: 'http://localhost:4001/' }));
};
```
