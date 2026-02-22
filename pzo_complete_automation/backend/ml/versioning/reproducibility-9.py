# Your code for creating and preparing the dataset goes here
pass

def train_model(dataset):
model = tf.keras.Sequential([
tf.keras.layers.Flatten(input_shape=(28, 28)),
tf.keras.layers.Dense(128, activation='relu'),
tf.keras.layers.Dropout(0.2),
tf.keras.layers.Dense(10, activation='softmax')
])

model.compile(loss=tf.keras.losses.categorical_crossentropy,
optimizer=tf.keras.optimizers.Adam(),
metrics=['accuracy'])

history = model.fit(dataset.train_images, dataset.train_labels,
epochs=10, batch_size=64)

return model, history

def save_dataset(dataset, version):
dataset_df = dataset.__dict__["data"]
dataset_df["version"] = version
dataset_df.to_csv(os.path.join(DATASETS_DIR, f"mnist_{version}.csv"))

with tarfile.open(os.path.join(DATASETS_DIR, f"mnist_{version}.tar.gz"), "w:gz") as tar:
tar.add(dataset_df.index, arcname=".")

def load_dataset(version):
dataset = tf.keras.datasets.mnist(train_images=None, train_labels=None,
validation_split=0, seed=42)

dataset.data = pd.read_csv(os.path.join(DATASETS_DIR, f"mnist_{version}.csv"))

(x_train, y_train), (x_test, y_test) = dataset.load_data()

return dataset

def save_model(model, history, version):
model.save(os.path.join(MODELS_DIR, f"mnist_{version}.h5"))
with open(os.path.join(MODELS_DIR, "history.txt"), "w") as f:
f.write(str(history.history))

def load_model(version):
model = load_model(os.path.join(MODELS_DIR, f"mnist_{version}.h5"))
history = tf.keras.utils.get_file("history.txt", os.path.join(MODELS_DIR, "history.txt"), cache_subdir="models")
with open(history) as f:
history = ast.literal_eval(f.read())
return model, history

def git_commit(version):
repo = git.Repo(PROJECT_ROOT)
commit_message = f"Version {version} data and model updated"
repo.git.add(A=repo.working_tree_dir, update=True)
repo.git.commit(m=commit_message)

if __name__ == "__main__":
if len(sys.argv) != 2:
print("Usage: python reproducibility-9.py <version>")
sys.exit(1)

version = sys.argv[1]

# Create or load dataset
dataset = load_dataset(version) if os.path.exists(os.path.join(DATASETS_DIR, f"mnist_{version}.csv")) else create_dataset()
save_dataset(dataset, version)

# Train the model and save it
model, history = train_model(dataset)
save_model(model, history, version)
git_commit(version)
```
