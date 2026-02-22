import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from tensorflow.keras.layers import Dense, Input
from tensorflow.keras.models import Model

def create_dataset(X, y):
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
return X_train, X_test, y_train, y_test

def create_model():
input_layer = Input(shape=(X.shape[1],))
x = Dense(32, activation='relu')(input_layer)
x = Dense(64, activation='relu')(x)
output_layer = Dense(1, activation='sigmoid')(x)
model = Model(inputs=input_layer, outputs=output_layer)
model.compile(loss='binary_crossentropy', optimizer='adam', metrics=['accuracy'])
return model

def train_model(X_train, y_train):
model = create_model()
history = model.fit(X_train, y_train, epochs=100, batch_size=32)
return model, history

def save_models(model, history, model_name='collapse_predictor'):
joblib.dump(model, f'{model_name}.joblib')
with open(f'{model_name}_history.pkl', 'wb') as file:
pickle.dump(history.history, file)

if __name__ == "__main__":
# Load your dataset
X = ...
y = ...

X_train, X_test, y_train, y_test = create_dataset(X, y)

model, history = train_model(X_train, y_train)

save_models(model, history)
