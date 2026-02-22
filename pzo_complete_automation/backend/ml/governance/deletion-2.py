import pandas as pd
from sklearn.model_selection import train_test_split

# Load training and validation datasets
X_train = pd.read_csv('training_dataset.csv')
y_train = pd.read_csv('training_labels.csv', header=None)
X_val = pd.read_csv('validation_dataset.csv')
y_val = pd.read_csv('validation_labels.csv', header=None)

# Split training data into train and validation sets (for demonstration purposes only)
X_train, X_val, y_train, y_val = train_test_split(X_train, y_train, test_size=0.2, random_state=42)

# Save the remaining training data for future use or archival
pd.DataFrame(X_train).to_csv('training_dataset_remaining.csv', index=False)
pd.DataFrame(y_train).to_csv('training_labels_remaining.csv', index=False, header=None)

# Delete the original training and validation datasets
os.remove('training_dataset.csv')
os.remove('training_labels.csv')
os.remove('validation_dataset.csv')
os.remove('validation_labels.csv')
