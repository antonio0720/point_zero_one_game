data = []
with open(file_path, 'r') as f:
for line in f:
row = list(map(float, line.strip().split()))
data.append(row)
return np.array(data)

def preprocess_data(X):
# Add any necessary data preprocessing steps here (e.g., normalization, feature scaling, etc.)
return X

def run_kmeans(X, n_clusters=4):
kmeans = KMeans(n_clusters=n_clusters)
kmeans.fit(X)
labels = kmeans.labels_
centroids = kmeans.cluster_centers_
return labels, centroids

def save_results(labels, centroids, file_path):
with open(file_path, 'w') as f:
for label in labels:
f.write('{}\n'.format(label))

if __name__ == "__main__":
data = preprocess_data(load_data('input.txt'))
labels, centroids = run_kmeans(data)
save_results(labels, centroids, 'output.txt')
```

This script loads a text file containing the data as comma-separated values (CSV), preprocesses it if needed, and performs KMeans clustering on the data with a specified number of clusters. The resulting labels and centroids are saved to an output file.
