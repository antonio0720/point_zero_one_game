# Load data and define model architecture
dataset = tf.data.TFRecordDataset(input_data.files)
...

model = tf.keras.Sequential([...])
...

# Define loss, optimizer, metrics, and compile the model
...

# Training loop and evaluation
model.fit(train_dataset, epochs=10, validation_data=val_dataset)

# Save trained model as a SavedModel
model.save('model', save_format='tf')

return Artifact('output-dir', contents={'model': 'model'})

def serve(input_model: Artifact) -> Artifact:
...

# Define the TensorFlow Serving serving spec and start a server
...

return Artifact('output-dir', contents={'serving_spec': 'serving_spec.pb'})

@create_component_from_func(base_image='tensorflow/pipelines-framework:latest')
def train_component(input_data):
return train(input_data)

@create_component_from_func(base_image='tensorflow/serving:latest')
def serve_component(input_model):
return serve(input_model)

pipeline_fn = function(
name='training-orchestration-10',
description='Orchestrates model training and serving',
pipeline=pipeline(
functions={
'train': train_component,
'serve': serve_component
},
nodes=[
funcs.Node('train', inputs={'input_data': Artifact('input-dir')}, outputs={'output_model': 'train'}),
funcs.Node('serve', inputs={'input_model': 'train'}, outputs={'output_serving_spec': 'serve'})
],
connections=[
fn_inputs['train']['input_data'] >> fn_outputs['train']['output_model'],
fn_outputs['serve']['output_serving_spec']
]
)
)
```
