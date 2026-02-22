import numpy as np
from sklearn.preprocessing import MinMaxScaler
from keras.models import Sequential
from keras.layers import Dense, LSTM, GRU
from keras.utils.np_utils import to_categorical

def prepare_data(sequences, window_size=10):
X, y = [], []
for sequence in sequences:
for i in range(len(sequence) - window_size):
seq_window = sequence[i : i + window_size]
if len(seq_window) == window_size:
X.append(np.array(seq_window))
y.append(to_categorical(sequence[i+window_size], num_classes=2))
return np.array(X), np.array(y)

def create_model(input_shape, output_shape):
model = Sequential()
model.add(LSTM(50, input_shape=input_shape))
model.add(Dense(25))
model.add(GRU(50, return_sequences=True))
model.add(Dense(25))
model.add(LSTM(100))
model.add(Dense(output_shape[1], activation='softmax'))

model.compile(loss='categorical_crossentropy', optimizer='adam')
return model

def train_model(model, X_train, y_train):
model.fit(X_train, y_train, epochs=50, batch_size=32)
