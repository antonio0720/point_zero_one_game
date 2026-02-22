def __init__(self):
self.pulls = [0] * 8
self.rewards = [0] * 8
self.mu_i = [0] * 8

def update(self, arm, reward):
self.pulls[arm] += 1
self.rewards[arm] += reward
self.mu_i[arm] = (self.pulls[arm] * self.rewards[arm] + np.mean(self.rewards)) / (self.pulls[arm] + 1)

def sample(self):
means = np.array([self.mu_i[i] for i in range(8)])
precisions = np.array([self.pulls[i] + 1 for i in range(8)])
probs = norm.cdf(np.zeros(8), loc=means, scale=np.sqrt(np.diag(np.linalg.inv(precisions))))
return np.random.choice([0, 1], p=[probs[i] for i in range(8)])
```

This code defines a `ChoiceDrillGenerator` class that keeps track of the rewards and pulls for each arm (0-7), calculates the estimated mean reward for each arm using Thompson Sampling, and generates a choice based on these means. The class provides two methods: `update()` to update the estimates after observing a reward from an arm, and `sample()` to generate a random choice according to the current estimates.
