def __init__(self, num_actions, num_states, learning_rate=0.1, reward_decay=0.9, e_greedy=0.5):
self.num_actions = num_actions
self.num_states = num_states
self.learning_rate = learning_rate
self.reward_decay = reward_decay
self.e_greedy = e_greedy
self.q_table = np.zeros([self.num_states, self.num_actions])

def choose_action(self, observed_state):
if np.random.uniform() < self.e_greedy:
return np.random.randint(0, self.num_actions)
else:
return np.argmax(self.q_table[observed_state])

def learn(self, current_state, action, next_state, reward):
q_predict = self.q_table[current_state + [action]]
max_future_q = np.max(self.q_table[next_state])
self.q_table[current_state + [action]] += self.learning_rate * (reward + self.reward_decay * max_future_q - q_predict)

def save(self, filename):
np.save(filename, self.q_table)

@staticmethod
def load(filename):
return QLearning(*np.load(filename).shape, **{'q_table': np.load(filename)})

@app.route('/api/v1/promote', methods=['POST'])
def promote():
q_learning = QLearning(num_actions=2, num_states=100)

def extract_state(user_data):
# Preprocess the user data to extract a state
state = preprocessing(user_data)
return int(np.mean(state))

def preprocessing(data):
# Your pre-processing function here
pass

if not request.json or 'data' not in request.json:
return jsonify({"error": "Invalid request"}), 400

data = request.json['data']
state = extract_state(data)

action = q_learning.choose_action(state)
if action == 1:
promotion_status = 'promoted'
else:
promotion_status = 'not promoted'

# Update the Q-table with the new observation and reward
next_state = extract_state(data)
reward = 0 if promotion_status == 'not promoted' else 1
q_learning.learn(state, action, next_state, reward)

return jsonify({"promotion_status": promotion_status})

@app.route('/api/v1/load', methods=['POST'])
def load():
if not request.json or 'filename' not in request.json:
return jsonify({"error": "Invalid request"}), 400

filename = request.json['filename']
q_learning = QLearning.load(filename)
return jsonify({"q_table": q_learning.q_table})

if __name__ == '__main__':
app.run(debug=True)
```
