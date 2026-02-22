def __init__(self, state_dim, action_dim, max_mem_size, batch_size):
self.state_dim = state_dim
self.action_dim = action_dim
self.max_mem_size = max_mem_size
self.batch_size = batch_size

self.memory = deque(maxlen=self.max_mem_size)
self.lr = 0.001
self.gamma = 0.95

self.model = self._create_model()

def _create_model(self):
model = models.Sequential()
model.add(layers.Dense(64, activation='relu', input_shape=(self.state_dim,)))
model.add(layers.Dense(64, activation='relu'))
model.add(layers.Dense(self.action_dim))

return model

def remember(self, state, action, reward, next_state, done):
self.memory.append((state, action, reward, next_state, done))

def replay(self, n_episodes=10):
mini_batch = random.sample(self.memory, self.batch_size * n_episodes)

X, Y = [], []
for state, action, reward, next_state, done in mini_batch:
X.append(state)
Y.append(np.zeros(self.action_dim) + reward)
if not done:
Y[-1][action] = reward + self.gamma * np.amax(self.model.predict(next_state)[0])

X, Y = np.array(X), np.array(Y)

self.model.compile(loss='mse', optimizer=tf.keras.optimizers.Adam(self.lr))
self.model.fit(X, Y, epochs=10, verbose=0)

def act(self, state):
if np.random.uniform() < 0.2:
return np.random.choice(self.action_dim)
else:
q_values = self.model.predict(state)
return np.argmax(q_values[0])
```
