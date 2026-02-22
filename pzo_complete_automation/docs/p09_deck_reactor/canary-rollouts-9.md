Canary Rollouts in Deck Reactor (v9)
=====================================

Deck Reactor is a versatile and powerful tool for managing Kubernetes deployments with zero downtime. In this document, we will discuss the Canary rollout strategy in Deck Reactor version 9.

Canary Deployment
------------------

A Canary deployment is a low-risk method of releasing new software versions by gradually rolling out changes to a small subset (Canary group) of users or resources. This approach allows for easy identification and resolution of potential issues before they affect the entire user base.

Deck Reactor supports Canary rollouts using Traffic Splitting, which distributes traffic between the existing deployment (Primary) and the new deployment (Canary). By default, 90% of traffic is directed to the Primary deployment, while the remaining 10% is allocated to the Canary deployment.

### Key components in Deck Reactor Canary rollouts:

1. **Service**: The Kubernetes Service object that exposes your application to clients.
2. **Deployments (Primary and Canary)**: The Kubernetes Deployment objects that manage your applications' pods.
3. **Ingress (optional)**: An Ingress resource for external access to the services.
4. **Annotations**: Additional metadata added to the Service, Deployments, or Ingress resources to configure Deck Reactor.

### Required annotations:

- `deck.k8s.io/rollout`: Enable rollouts and specify the desired rollout strategy (Canary).
- `deck.k8s.io/traffic-split`: Configure traffic splitting between the Primary and Canary deployments.
- `deck.k8s.io/canary-check`: Define health checks to assess the Canary deployment's readiness.

### Optional annotations:

- `deck.k8s.io/primary-labels`: Labels to identify the Primary deployment pods.
- `deck.k8s.io/canary-labels`: Labels to identify the Canary deployment pods.

### Example configuration:

```yaml
apiVersion: v1
kind: Service
metadata:
name: my-app
annotations:
deck.k8s.io/rollout: "true"
deck.k8s.io/traffic-split: "10"
deck.k8s.io/canary-check: "readinessProbe,livenessProbe"
spec:
selector:
app: my-app
ports:
- name: http
port: 80
targetPort: 8080
---
apiVersion: apps/v1
kind: Deployment
metadata:
name: my-app-primary
labels:
app: my-app
deployment: primary
spec:
replicas: 5
selector:
matchLabels:
app: my-app
template:
metadata:
labels:
app: my-app
deployment: primary
spec:
containers:
- name: my-app
image: my-primary-image
ports:
- containerPort: 8080
---
apiVersion: apps/v1
kind: Deployment
metadata:
name: my-app-canary
labels:
app: my-app
deployment: canary
spec:
replicas: 2
selector:
matchLabels:
app: my-app
template:
metadata:
labels:
app: my-app
deployment: canary
spec:
containers:
- name: my-app
image: my-canary-image
ports:
- containerPort: 8080
```

In this example, we have a Service named `my-app` with two deployments: `my-app-primary` and `my-app-canary`. The Service is configured to use the Canary rollout strategy with 10% of traffic directed to the Canary deployment. Health checks are defined using the `readinessProbe` and `livenessProbe`.

By annotating your Services, Deployments, or Ingress resources with appropriate metadata, you can easily leverage Deck Reactor's powerful Canary rollouts to manage safe and efficient updates of your Kubernetes applications.
