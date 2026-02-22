# Load the data
df = input_data.read_pandas()

model = Sequential()
model.add(Dense(12, input_dim=df.shape[1], activation='relu'))
model.add(Dropout(0.2))
model.add(Dense(8, activation='relu'))
model.add(Dropout(0.2))
model.add(Dense(1, activation='sigmoid'))

# Compile the model
model.compile(loss='binary_crossentropy', optimizer='adam', metrics=['accuracy'])

# Train the model
model.fit(df.drop('target', axis=1), df['target'], epochs=50, batch_size=32)

# Save the model as a SavedModel for serving later
model.save('model')

@pipeline
def training_orchestration():
# Define input data artifact
input_data = create_distinct_output('input-data', df=pd.DataFrame({...}))

# Run the build and train function
build_and_train_model(input_data)

# Kubeflow Pipelines command to run the pipeline locally
training_orchestration().compile(operator_runtime_image='tensorflow/pipelines-operator:latest')
```

This script defines a Kubeflow Pipelines pipeline with a single step that loads data, builds and trains a simple neural network, and saves the trained model as a SavedModel. The input data is defined as an artifact named 'input-data' which should be replaced with your actual input data source.
