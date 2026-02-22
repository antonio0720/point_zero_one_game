```bash
pip install locust
```

Now, create a new file named `locustfile.py` and fill it with the following content:

```python
from locust import HttpLocust, TaskSet, task

class User(TaskSet):
@task
def index(self):
self.client.get("/")

# Add more tasks here if needed

class WebsiteUser(HttpLocust):
task_set = User
min_wait = 5000
max_wait = 9000

def on_start(locust):
locust.run_command("python -m http.server 8080 &")
```

This script defines a simple Locust test with one user and one task (`index`), which sends an HTTP GET request to the root URL ("/"). The minimum and maximum wait times have been set to simulate realistic user behavior.

Now, create a simple Node.js backend server:

```bash
mkdir my-app && cd my-app
npm init -y
touch index.js
```

Fill the `index.js` file with the following content:

```javascript
const http = require('http');

const hostname = '127.0.0.1';
const port = 8080;

const server = http.createServer((req, res) => {
res.statusCode = 200;
res.setHeader('Content-Type', 'text/plain');
res.end('Hello World\n');
});

server.listen(port, hostname, () => {
console.log(`Server running at http://${hostname}:${port}/`);
});
```

This code creates a simple HTTP server that listens on port 8080 and responds with "Hello World" when receiving an HTTP GET request to the root URL ("/").

Finally, you can run both scripts simultaneously:

```bash
# Run the Python script in one terminal
python locustfile.py -f locustfile.py --headless --host 127.0.0.1 --no-web-ui --run 10000

# Run the Node.js server in another terminal
node index.js
```

The Python script will start a Locust test with 10,000 runs per second (--run 10000), and the Node.js server will serve as the application under test. The `--headless` flag disables the web UI for the Locust CLI, while the `--no-web-ui` flag prevents the creation of a separate process to start the UI.

This example assumes that both scripts are in the same working directory and uses port 8080 for both. You can customize the code as needed based on your specific requirements.
