def __init__(self, window_size=100, smoothing_constant=0.15):
self.window_size = window_size
self.smoothing_constant = smoothing_constant
self.ewma_values = None
self.data_len = 0

def update(self, new_data):
if not self.ewma_values:
self.ewma_values = np.copy(new_data)
self.ewma_values = np.ewma(self.ewma_values, com=self.smoothing_constant)
self.data_len += len(new_data)
return None

new_data = np.copy(new_data)
new_data = np.append(new_data, self.ewma_values[-self.window_size:])
new_data = np.ewma(new_data, com=self.smoothing_constant)
mse = mean_squared_error(self.ewma_values, new_data)
drift_detected = mse > 3 * (mse.mean() + mse.std())

if drift_detected:
self.ewma_values = np.copy(new_data)
self.data_len += len(new_data)

return drift_detected

def get_trend_and_seasonality(self, data):
stl_data = seasonal_decompose(data, model='additive', period=12)
trend = stl_data.trend
seasonality = stl_data.seasonal
return trend, seasonality

def is_stationary(self, data):
dfa = adfuller(data, autolag='AIC')
stationary = dfa[1] < 0.05
return stationary
```

Usage example:

```python
drift_detector = DriftDetector(window_size=100, smoothing_constant=0.15)
trend, seasonality = drift_detector.get_trend_and_seasonality(data)
if not drift_detector.is_stationary(data):
print("Data is not stationary")

for new_data in data_stream:
if drift_detector.update(new_data):
print("Drift detected!")
```
