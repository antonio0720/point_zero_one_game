pipeline = tfx_v1.pipeline.Pipeline(
pipeline_name=pipeline_name,
pipeline_root=_get_pipeline_root(),
)

example_gen = tfx_v1.components.example_gen.ExampleGen(
name='ExampleGen',
input_base=_get_data_root(),
config=tfxio_client.get_config("example_gen", "config.json")
)

schema_gen = tfx_v1.components.schema_gen.SchemaGen(
name='SchemaGen',
input_examples=example_gen,
config=tfxio_client.get_config("schema_gen", "config.json")
)

stats_gen = tfx_v1.components.stats_gen.StatsGen(
name='StatsGen',
input_examples=example_gen,
config=tfxio_client.get_config("stats_gen", "config.json")
)

feature_gen = tfx_v1.components.feature_gen.FeatureGen(
name='FeatureGen',
input_examples=example_gen,
input_schema=schema_gen.outputs['schema'],
config=tfxio_client.get_config("feature_gen", "config.json")
)

example_validator = tfx_v1.components.example_validator.ExampleValidator(
name='ExampleValidator',
input_examples=stats_gen.outputs['statistics'],
input_schema=schema_gen.outputs['schema'],
config=tfxio_client.get_config("example_validator", "config.json")
)

example_splitter = tfx_v1.components.example_splitter.ExampleSplitter(
name='ExampleSplitter',
input_examples=stats_gen.outputs['statistics'],
config=tfxio_client.get_config("example_splitter", "config.json")
)

feature_validator = tfx_v1.components.feature_validator.FeatureValidator(
name='FeatureValidator',
input_examples=stats_gen.outputs['statistics'],
input_features=feature_gen.outputs['features'],
config=tfxio_client.get_config("feature_validator", "config.json")
)

orchestrator = tfx_v1.components.orchestrator.Orchestrator(
name='Orchestrator',
pipeline_run=pipeline,
config=tfxio_client.get_config("orchestrator", "config.json")
)

pipeline.add_metadata('kubeflow', {'namespace': 'your-namespace'})

return pipeline

def _get_pipeline_root():
# Replace this with your pipeline root path.
return '/path/to/ml-pipeline'

def _get_data_root():
# Replace this with your data root path.
return '/path/to/data'
```
