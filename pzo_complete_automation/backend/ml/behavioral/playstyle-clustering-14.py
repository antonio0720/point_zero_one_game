data = pd.read_csv(file)
return data.drop('user_id', axis=1)

def preprocess_data(df):
scaler = StandardScaler()
df_scaled = pd.DataFrame(scaler.fit_transform(df), columns=df.columns)
return df_scaled

def fit_kmeans(X, n_clusters):
kmeans = KMeans(n_clusters=n_clusters)
kmeans.fit(X)
return kmeans

def predict_cluster(kmeans, X):
predictions = kmeans.predict(X)
return predictions

if __name__ == "__main__":
data = read_data('user_gameplay_data.csv')
preprocessed_data = preprocess_data(data)
kmeans = fit_kmeans(preprocessed_data, 4) # You can change the number of clusters here
cluster_predictions = predict_cluster(kmeans, preprocessed_data)
print("Clusters:", cluster_predictions)
```

This script reads a CSV file containing user gameplay data (excluding the 'user_id' column), scales and standardizes the data using StandardScaler, trains a KMeans clustering algorithm with 4 clusters, predicts the cluster for each data point, and then prints the predicted clusters.
