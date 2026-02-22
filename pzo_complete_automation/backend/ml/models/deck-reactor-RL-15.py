def __init__(self, action_dim, state_dim, hidden_layer_size=64, learning_rate=0.01):
super(DeckReactorRLModel, self).__init__()
self.state_input = Input(shape=(state_dim,))
self.fc1 = Dense(hidden_layer_size, activation='relu')
self.fc2 = Dense(action_dim, activation='softmax')
self.learning_rate = learning_rate

def call(self, x):
x = self.fc1(x)
return self.fc2(x)

def sample_action(self, state):
actions_prob = self.predict(state)
action = tf.random.categorical(actions_prob, 1)[0][0].numpy()
return action
```
