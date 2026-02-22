seq_x, seq_y = train[i-timesteps:i, :], train[i, :]
X_train.append(seq_x)
y_train.append(seq_y)
X_train, y_train = np.array(X_train), np.array(y_train)
X_train = np.reshape(X_train, (X_train.shape[0], X_train.shape[1], output_dim))

# Prepare the test data
X_test = []
y_test = []
for i in range(timesteps, len(test)):
seq_x, seq_y = test[i-timesteps:i, :], test[i, :]
X_test.append(seq_x)
X_test = np.array(X_test)
X_test = np.reshape(X_test, (X_test.shape[0], X_test.shape[1], output_dim))

# Create the LSTM model
model = Sequential()
model.add(LSTM(50, activation='relu', input_shape=(X_train.shape[1], output_dim)))
model.add(Dense(1))
model.compile(optimizer='adam', loss='mean_squared_error')

# Train the model
model.fit(X_train, y_train, epochs=50, batch_size=32)

# Test the model
loss = model.evaluate(X_test, y_test)
print('Loss:', loss)
```
