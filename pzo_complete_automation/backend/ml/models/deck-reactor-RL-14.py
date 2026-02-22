import tensorflow as tf
from tensorflow.keras.layers import Dense, Flatten
from collections import deque

class Model(tf.keras.Model):
def __init__(self, state_dim, action_dim, max_mem_size=1000000):
super(Model, self).__init__()
self.memory = deque(maxlen=max_mem_size)
self.state_dim = state_dim
self.action_dim = action_dim

self.main = tf.keras.Sequential([
Flatten(input_shape=(1, state_dim)),
Dense(64, activation='relu'),
Dense(action_dim)
])

def remember(self, state, action, reward, next_state, done):
self.memory.append((state, action, reward, next_state, done))

def choose_action(self, state):
if np.random.rand() < 0.2:
return random.choice(range(self.action_dim))

actions = self.main.predict(state)
return np.argmax(actions[0])

def learn(self, batch_size=32):
if len(self.memory) < batch_size:
return

minibatch = random.sample(self.memory, batch_size)
states, actions, rewards, next_states, dones = zip(*minibatch)
states = np.stack(states)
next_states = np.stack(next_states)

q_values = self.main.predict(states)
next_q_values = self.main.predict(next_states)

max_next_q_value = tf.reduce_max(next_q_values, axis=1)
target_q_values = rewards + (1 - dones) * max_next_q_value

loss = tf.reduce_mean(tf.square(target_q_values - q_values))
self.main.compile('adam', 'mse')
self.main.fit(states, [q_values], epochs=1, verbose=0)
