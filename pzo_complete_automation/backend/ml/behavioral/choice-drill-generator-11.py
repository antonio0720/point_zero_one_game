import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split

# Sample data for simplicity, replace with actual user data
user_data = [
(1, 'watch_movie'),
(2, 'play_game'),
(3, 'listen_music'),
(4, 'read_book'),
# ... add more examples
]

# Define function to create feature matrix and target vector for the given user data
def create_features(user_data):
X = np.zeros((len(user_data), len(set([action for _, action in user_data]))))

for i, (userId, action) in enumerate(user_data):
X[i][action] = 1

y = np.array([0] * len(user_data))  # initialize as all zeros (assuming initial preference is none)

return X, y

# Define function to train the logistic regression model on the user data and generate personalized choices
def train_and_generate(X, y):
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

model = LogisticRegression()
model.fit(X_train, y_train)

return model

# Main function to generate personalized choices for a given user
def generate_choices(user, model):
# Assuming user input is an integer representing the user id
user_data = [(user, action) for _, action in user_data]  # filter user data for the specific user

X, y = create_features(user_data)
prediction = model.predict(X)

return prediction[0]

# Create example user data and train the model
user_data = [
(1, 'watch_movie'),
(2, 'play_game'),
(3, 'listen_music'),
(4, 'read_book'),
# ... add more examples for training
]
X, y = create_features(user_data)
model = train_and_generate(X, y)

# Test the model with a new user
new_user = 5
print(generate_choices(new_user, model))
