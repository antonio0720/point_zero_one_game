X, Y = [], []
for i in range(len(dataset)-look_back-1):
a = dataset[i:(i+look_back), 0]
X.append(a)
Y.append(dataset[i + look_back, 0])
return np.array(X), np.array(Y)

def train_model(train_x, train_y):
model = Sequential()
model.add(LSTM(4, input_shape=(1, train_x.shape[1]), return_sequences=True))
model.add(LSTM(4, return_sequences=False))
model.add(Dense(1))
model.compile(loss='mean_squared_error', optimizer='adam')

model.fit(train_x, train_y, epochs=50, batch_size=1, verbose=2)
return model

def predict_anomaly(model, data, look_back=1):
x_test = []
for i in range(len(data)-look_back-1):
x_test.append(data[i:(i+look_back), 0])
x_test = np.array(x_test)

pred_yhat = model.predict(x_test)
yhat = pred_yhat.flatten()
anomalies = []

for i in range(len(data)):
if data[i, 0] > yhat[i]:
anomalies.append(i)

return anomalies
```

In order to use the provided code, you should replace `dataset` with your time series data as a NumPy array. The dataset is expected to have one column and more rows than necessary for lookback. After that, you can train the model with `train_model()`, predict anomalies with `predict_anomaly()`.
