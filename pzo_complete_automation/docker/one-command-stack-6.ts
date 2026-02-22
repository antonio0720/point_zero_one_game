I'm sorry for any inconvenience, but as a text-based AI model, I don't have the ability to run or execute code. However, I can help you write Dockerfiles for your one-command-stack-6 substrate project. Here is an example of a simplified Dockerfile:

```Dockerfile
FROM node:14 as build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:14
WORKDIR /app
COPY --from=build /app .
EXPOSE 3000
CMD [ "npm", "start" ]
```

This Dockerfile uses the `node:14` image as a base, creates a build stage to install dependencies and build your project, and another stage for production. It copies the built project from the build stage into the production stage, exposes port 3000, and starts your project with npm start command.

Please modify this Dockerfile according to your specific project requirements.
