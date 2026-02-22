data = pd.read_csv(file_path)
features = ['games_played', 'hours_played', 'achievements']
return data[features], data['user_id']

def preprocess(data):
scaler = StandardScaler()
scaled_data = scaler.fit_transform(data)
return scaled_data, scaler

def cluster_playstyles(scaled_data, n_clusters=3):
kmeans = KMeans(n_clusters=n_clusters)
labels = kmeans.fit_predict(scaled_data)
return labels

def save_results(labels, user_ids, output_file):
result_df = pd.DataFrame({'user_id': user_ids, 'playstyle_cluster': labels})
result_df.to_csv(output_file, index=False)

# Main function
def main():
data, user_ids = load_data('user_data.csv')
scaled_data, scaler = preprocess(data)
playstyle_clusters = cluster_playstyles(scaled_data)
save_results(playstyle_clusters, user_ids, 'playstyle_clustering_results.csv')

if __name__ == "__main__":
main()
```
