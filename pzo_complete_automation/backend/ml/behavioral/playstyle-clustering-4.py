from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
import pandas as pd

# Load the data
data = pd.read_csv('user_data.csv')

# Normalize the data using StandardScaler
scaler = StandardScaler()
scaled_data = scaler.fit_transform(data)

# Choose the number of clusters (playstyles)
n_clusters = 4

# Train a KMeans model with the scaled data
kmeans = KMeans(n_clusters=n_clusters, random_state=42)
kmeans.fit(scaled_data)

# Save the cluster labels to the DataFrame
data['playstyle'] = kmeans.labels_

# Save the trained model and scaler separately for future use
import joblib
joblib.dump(kmeans, 'playstyle_clustering_model.pkl')
joblib.dump(scaler, 'playstyle_scaler.pkl')
