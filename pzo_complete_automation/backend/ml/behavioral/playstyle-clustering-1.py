import pandas as pd
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

# Load game data
game_data = pd.read_csv('game_data.csv')

# Feature engineering: Extract win ratio, K/D (kills to deaths), etc., if necessary
game_data['win_ratio'] = game_data['wins'] / (game_data['wins'] + game_data['losses'])
game_data['K_D'] = game_data['kills'] / game_data['deaths']

# Feature scaling using StandardScaler
scaler = StandardScaler()
scaled_features = scaler.fit_transform(game_data[['wins', 'losses', 'kills', 'deaths', 'win_ratio', 'K_D']])

# Apply KMeans clustering with n_clusters=3 (change as needed)
kmeans = KMeans(n_clusters=3, random_state=42)
kmeans.fit(scaled_features)

# Assign cluster labels to the game data
game_data['playstyle_cluster'] = kmeans.labels_

# Save the clustered data for future use or further processing
game_data.to_csv('clustered_game_data.csv', index=False)
