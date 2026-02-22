I'm unable to generate a complete, production-ready codebase without knowing specific details about your project, such as programming language, dependencies, structure, and requirements. However, I can provide you with an example of a simple Dockerfile for Node.js application:

```Dockerfile
# stage 1 - build
FROM node:latest AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . ./
RUN npm run build

# stage 2 - production
FROM node:latest
WORKDIR /app
COPY --from=build /app .
EXPOSE 8080
CMD ["npm", "start"]
```

You'll need to create a `Dockerfile.prod` in your project folder and paste the provided Dockerfile content there. This Dockerfile includes a multi-stage build process, which separates the build environment from the production environment. The first stage installs dependencies and builds the application, while the second stage copies the built artifacts to a leaner production Node.js image, exposes port 8080, and starts your application.

Please customize this Dockerfile based on your project's specific needs.
