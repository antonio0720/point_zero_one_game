config.load_kube_config()
return client.ApiClient()

def create_namespace(api_client):
v1 = client.CoreV1Api(api_client)
metadata = client.V1ObjectMeta(name="ml-rollback")
namespace = client.V1Namespace(metadata=metadata)
v1.create_namespace(body=namespace)

def create_deployment(api_client, deployment_name, image, namespace):
v1 = client.AppsV1Api(api_client)
container = client.V1Container(
name="ml-container",
image=image,
ports=[client.V1ContainerPort(container_port=80)]
)
template = client.V1PodTemplateSpec(
metadata=client.V1ObjectMeta(),
spec=client.V1PodSpec(containers=[container])
)
spec = client.V1DeploymentSpec(
replicas=3,
selector={"matchLabels": {"app": deployment_name}},
template=template
)
metadata = client.V1ObjectMeta(name=deployment_name)
body = client.V1Deployment(api_version="apps/v1", kind="Deployment", metadata=metadata, spec=spec)
v1.create_namespaced_deployment(namespace=namespace, body=body)

def create_service(api_client, service_name, deployment_name, namespace):
v1 = client.CoreV1Api(api_client)
selector = {"app": deployment_name}
service = client.V1Service(
api_version="v1",
kind="Service",
metadata=client.V1ObjectMeta(name=service_name),
spec=client.V1ServiceSpec(
selector=selector,
ports=[client.V1ServicePort(port=80, target_port=80)],
type="ClusterIP"
)
)
v1.create_namespaced_service(namespace=namespace, body=service)

def get_deployment(api_client, namespace, deployment_name):
v1 = client.AppsV1Api(api_client)
return v1.read_namespaced_deployment(name=deployment_name, namespace=namespace)

def create_kill_switch(api_client, deployment_name, namespace):
deployment = get_deployment(api_client, namespace, deployment_name)
if not deployment:
raise Exception("Deployment does not exist.")

deployment.spec.template.metadata.annotations = {
"kubernetes.io/taint": f"error-{deployment_name}=true:NoSchedule",
"killswitch": "on"
}

api_client.patch_namespaced_deployment(namespace, deployment_name, deployment)

def main():
api_client = load_config()
create_namespace(api_client)
create_deployment(api_client, "ml-v1", "ml-v1:latest", "ml-rollback")
create_deployment(api_client, "ml-v2", "ml-v2:latest", "ml-rollback")
create_service(api_client, "ml-service", "ml-v1", "ml-rollback")

# Enable kill switch for v2 deployment
create_kill_switch(api_client, "ml-v2", "ml-rollback")

if __name__ == "__main__":
main()
```
