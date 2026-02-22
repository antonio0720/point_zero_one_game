from tensorflow.keras.models import load_model
import docker
import os
import base64
import urllib3

client = docker.from_env()

def get_model():
model = load_model('path/to/saved_model')
return model

def push_model_to_tensorflow_serving(model, image_name):
img = client.images.build(
path='.',
tag=image_name,
rm=True,
dockerfile='Dockerfile'
)

img.push(repository=f'{image_name}')

def deploy_model_to_kubernetes(image_name):
kube_config = os.path.join(os.path.expanduser('~'), '.kube', 'config')
clientset = urllib3.PoolManager()
config = clientset.request('GET', f'http://127.0.0.1:8001/api/v1/namespaces/default/services/tensorflow-serving:apiserving/load', prels=True, stream_response=True, verify=False)
config.raw.decode('utf-8')
with open(kube_config, 'w') as f:
f.write(config.raw.decode('utf-8'))

deployment = '''
apiVersion: apps/v1
kind: Deployment
metadata:
name: tf-serving-deployment
spec:
selector:
matchLabels:
app: tensorflow-serving
template:
metadata:
labels:
app: tensorflow-serving
spec:
containers:
- name: tensorflow-serving
image: {}
ports:
- containerPort: 8501
name: serving
args:
- server
--rest_options=name=SERVER_NAME,value=tf-serving-predictions
--model_servers=127.0.0.1:8500
env:
- name: MODEL_NAME
value: serving
- name: REST_API_PORT
value: "8501"
type: ClusterIP
'''

model_name = 'path/to/saved_model.pb'
with open(model_name, 'rb') as model_file:
encoded_model = base64.b64encode(model_file.read()).decode('utf-8')

deployment = deployment.format(image_name)
api_version = 'apps/v1'
kind = 'Deployment'
metadata = {'name': 'tf-serving-deployment'}
spec = {
'selector': {'matchLabels': {'app': 'tensorflow-serving'}},
'template': {
'metadata': {'labels': {'app': 'tensorflow-serving'}},
'spec': {
'containers': [
{
'name': 'tensorflow-serving',
'image': image_name,
'ports': [{
'containerPort': 8501,
'name': 'serving'
}],
'args': ['server', '--rest_options=name=SERVER_NAME,value=tf-serving-predictions', '--model_servers=127.0.0.1:8500'],
'env': [
{'name': 'MODEL_NAME', 'value': 'serving'},
{'name': 'REST_API_PORT', 'value': "8501"}
]
}
],
'type': 'ClusterIP'
}
}
}

k8s = clientset.api(group='apps', version=api_version, kind=kind)
deployment = k8s.create_namespaced_deployment(namespace='default', body=deployment, metadata=metadata, spec=spec)
print('Deployment created:', deployment.metadata['name'])

model = get_model()
push_model_to_tensorflow_serving(model, 'my-custom-image')
deploy_model_to_kubernetes('my-custom-image')
