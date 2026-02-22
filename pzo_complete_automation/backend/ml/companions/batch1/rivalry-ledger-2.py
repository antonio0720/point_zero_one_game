from flask import Flask, request, jsonify
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
import numpy as np

app = Flask(__name__)

# Load training data (assuming it's in a CSV file with headers 'team1', 'team2', 'match_result')
data = pd.read_csv('train.csv')

X = np.array(data[['team1', 'team2']]).reshape(-1, 2)
y = np.array(data['match_result'])

# Split the data into training and testing sets (80% train and 20% test)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# Train the model using Random Forest Regressor
model = RandomForestRegressor(n_estimators=100, random_state=42)
model.fit(X_train, y_train)

@app.route('/predict', methods=['POST'])
def predict():
data = request.get_json()
team1 = data['team1']
team2 = data['team2']

prediction = model.predict([[team1, team2]])

return jsonify({'prediction': int(prediction[0])})

if __name__ == '__main__':
app.run(debug=True)
