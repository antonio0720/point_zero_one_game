import random
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix

# Sample user data with features (x) and choices (y)
user_data = [
({'age': 20, 'gender': 'male', 'education': 'college'}, [1, 0]),
({'age': 30, 'gender': 'female', 'education': 'high school'}, [0, 1]),
# Add more user data here...
]

# Sample question data with features (x) and correct choices (y)
question_data = [
({'topic': 'math', 'difficulty': 'easy'}, [2, 4]),
({'topic': 'science', 'difficulty': 'hard'}, [1, 3]),
# Add more question data here...
]

def load_data(data):
X = []
y = []
for entry in data:
features = {}
for key, value in entry.items():
features[key] = np.array(value)
X.append(features)
y.append(np.eye(len(entry))[entry['choice']])  # one-hot encoding of choice
return np.array(X), np.array(y)

# Train a logistic regression model on user and question data
X_user, y_user = load_data(user_data)
X_question, y_question = load_data(question_data)
model = LogisticRegression().fit(np.hstack((X_user, X_question)), np.hstack((y_user, y_question)))

def predict_choice(user_features, question_features):
input_data = np.array([[user_features['age'], user_features['gender'][0], user_features['education'].index,
question_features['topic'], question_features['difficulty'].index]])
return model.predict(input_data)[0]

# Example usage:
user = {'age': 25, 'gender': 'female', 'education': 'master'}
question = {'topic': 'science', 'difficulty': 'easy'}
predicted_choice = predict_choice(user, question)
print(f"Predicted choice for user {user} and question {question}: {predicted_choice}")
