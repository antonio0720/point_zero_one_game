import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers

class SpectatorTheater5(keras.Model):
def __init__(self, input_dim=784, hidden_units=[256, 128], output_dim=10):
super(SpectatorTheater5, self).__init__()
self.dense1 = layers.Dense(hidden_units[0], activation='relu', input_shape=(input_dim,))
self.dropout1 = layers.Dropout(0.2)
self.dense2 = layers.Dense(hidden_units[1], activation='relu')
self.dropout2 = layers.Dropout(0.2)
self.output_layer = layers.Dense(output_dim)

def call(self, x):
x = self.dense1(x)
x = self.dropout1(x)
x = self.dense2(x)
x = self.dropout2(x)
return self.output_layer(x)
