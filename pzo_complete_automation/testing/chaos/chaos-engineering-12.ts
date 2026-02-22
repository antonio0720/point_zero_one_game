First, install Locust and required dependencies:

```bash
pip install locust python-kubectl
```

Create a `Dockerfile` for your application:

```dockerfile
FROM node:14
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
EXPOSE 8080
CMD ["npm", "start"]
```

Build and push the Docker image to a registry (replace `YOUR_REGISTRY_USERNAME` and `YOUR_REGISTRY_PASSWORD`):

```bash
docker build -t YOUR_REGISTRY_USERNAME/your-app .
docker login
docker tag YOUR_REGISTRY_USERNAME/your-app:latest YOUR_REGISTRY_USERNAME/your-app:v1
docker push YOUR_REGISTRY_USERNAME/your-app:v1
```

Create a `locustfile.py` for the load testing script:

```python
from locust import HttpUser, between, task

class QuickStartUser(HttpUser):
host = "your-app-service"  # Replace with your service name or IP
wait_time = between(1, 4)

@task
def index(self):
self.client.get("/")
```

Create a `k8s-deploy.yaml` for the Kubernetes deployment:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
name: your-app-service
spec:
replicas: 3
selector:
matchLabels:
app: your-app
template:
metadata:
labels:
app: your-app
spec:
containers:
- name: your-app
image: YOUR_REGISTRY_USERNAME/your-app:v1
ports:
- containerPort: 8080
---
apiVersion: v1
kind: Service
metadata:
name: your-app-service
spec:
selector:
app: your-app
type: LoadBalancer
```

Deploy the application and Locust script using `kubectl`:

```bash
kubectl apply -f k8s-deploy.yaml
locust --host YOUR_SERVICE_IP --headless --users 100 --hatch 5 --run locustfile.py
```

Replace `YOUR_SERVICE_IP` with the IP address of your deployed service. This will start a load test with 100 users, each hatch having 5 users (total 500 simultaneous users). Adjust user count and hatches as needed for your application.
