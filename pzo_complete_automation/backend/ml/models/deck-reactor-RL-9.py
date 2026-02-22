def __init__(self, state_dim, action_dim, reward_scale):
self.state_dim = state_dim
self.action_dim = action_dim
self.reward_scale = reward_scale

self.learning_rate = 0.001
self.gamma = 0.99

self.memory = deque(maxlen=5000)

self.create_network()

def create_network(self):
self.model = tf.keras.Sequential()
self.model.add(tf.keras.layers.Dense(64, activation='relu', input_shape=(self.state_dim,)))
self.model.add(tf.keras.layers.Dense(64, activation='relu'))
self.model.add(tf.keras.layers.Dense(self.action_dim))
self.model.compile(loss='mse', optimizer=tf.keras.optimizers.Adam(learning_rate=self.learning_rate))

def remember(self, state, action, reward, next_state, done):
self.memory.append((state, action, reward, next_state, done))

def train(self):
if len(self.memory) < 500:
return self.model

batch = random.sample(self.memory, 32)
states, actions, rewards, next_states, dones = zip(*batch)
states = tf.convert_to_tensor(states)
actions = tf.convert_to_tensor(actions)
rewards = tf.convert_to_tensor([self.reward_scale * r for r in rewards])
next_states = tf.convert_to_tensor(next_states)
dones = tf.convert_to_tensor(dones)

values = self.model.predict(states)
next_values = self.model.predict(next_states)
max_values = tf.reduce_max(next_values, axis=1)
targets = rewards + self.gamma * max_values * (1 - dones)

loss = self.model.train_on_batch(states, targets)

return self.model

def predict(self, state):
return self.model.predict(tf.convert_to_tensor([state]))[0]
```
