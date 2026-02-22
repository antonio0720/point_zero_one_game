build-and-deploy:
name: Build and Deploy
runs-on: ubuntu-latest
steps:
- uses: actions/checkout@v2
with:
fetch-depth: 0

- name: Use Node.js
uses: actions/setup-node@v2
with:
node-version: 14

- name: Install dependencies
run: npm install

- name: Build Docker Image
run: docker build -t my-app .

- name: Run Tests
run: docker run --rm my-app npm test

- name: Build Production
run: docker run --rm my-app npm run build:prod

- name: Deploy to Server
uses: appleboy/ssh-action@master
with:
host: ${{ secrets.HOST }}
username: ${{ secrets.USERNAME }}
password: ${{ secrets.PASSWORD }}
port: ${{ secrets.PORT }}
key: ${{ secrets.SSH_KEY }}
script: |
cd my-app/dist
sudo service my-service stop
rm -rf /var/www/*
cp -R * /var/www/
sudo service my-service start
```

This workflow triggers on push events, sets up Node.js environment, installs dependencies, builds a Docker image, runs tests, builds for production, and deploys the built artifacts to a server using SSH.

Please replace `my-app`, `my-service`, and the server details with your own project name and deployment configuration. Also, ensure that you have set up GitHub Secrets for the sensitive information such as SSH keys and server credentials.
