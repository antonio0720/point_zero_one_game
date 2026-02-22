1. Docker Compose (`docker-compose.yml`)

```yaml
version: "3.9"
services:
chaosmonkey:
image: databricks/chaosmonkey:latest
container_name: chaosmonkey
ports:
- "8081:8080"
environment:
- CHAOSMONKEY_AGENT_PORT=8080
- CHAOSMONKEY_API_KEY=${CHAOSMONKEY_API_KEY}

locust:
image: locustio/locustio:latest
container_name: locust
depends_on:
- chaosmonkey
ports:
- "8089:8089"
environment:
- LOCUST_HEADLESS=true
- LOCUST_HOST=${LOCUST_HOST}
- LOCUST_PORT=8089
- CHAOSMONKEY_API_KEY=${CHAOSMONKEY_API_KEY}
- CHAOSMONKEY_AGENT_PORT=8080
```

2. `.env` file for environment variables

```
CHAOSMONKEY_API_KEY=your_chaosmonkey_api_key
LOCUST_HOST=your_application_host
```

3. Start the services using Docker Compose:

```sh
docker-compose up
```

4. Locust test script (`locustfile.py`)

```python
from locust import HttpUser, task, between

class WebsiteUser(HttpUser):
host = "your_application_host"
wait_time = between(1, 2)

@task
def index(self):
self.client.get("/")
```
