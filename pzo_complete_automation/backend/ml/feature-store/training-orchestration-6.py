from dagster import pipeline, asset, solid, InPort, OutPort, repository
from dagster_pipelinestage import PipelineStage
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Dense
from sklearn.datasets import load_iris
import docker

def create_model():
model = Sequential()
model.add(Dense(10, activation='relu', input_shape=(4,)))
model.add(Dense(1))
return model

def train_model(iris, model):
model.compile(loss='mean_squared_error', optimizer='adam')
history = model.fit(iris.data, iris.target, epochs=50)
return model, history

def init_docker():
client = docker.from_env()
image = client.images.pull('tensorflow/tensorflow')
container = client.containers.run(image, detach=True, name='tensorflow-container')
return client, container

@solid
def load_iris_data():
iris = load_iris()
return iris

@asset
def train_model_asset():
client, container = init_docker()
iris = load_iris_data()
model = create_model()
model, _ = train_model(iris, model)
client.containers.get('tensorflow-container').exec_run(command=['pwd', 'ls'])  # Check that the container is running
return model

@pipeline
def training_orchestration():
iris = load_iris_data()
model = train_model_asset()

training_orchestration_repo = repository(name="training-orchestration")
