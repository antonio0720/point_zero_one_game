import tensorflow as tf
from tensorflow.keras import layers, models
from tensorflow.keras.preprocessing import image

def load_and_preprocess_image(img_path):
img = image.load_img(img_path, target_size=(299, 299))
x = image.img_to_array(img)
x = tf.expand_dims(x, axis=0)
x /= 255.
return x

def hic_v10_model():
model = models.Sequential()
model.add(layers.Conv2D(32, (3, 3), activation='relu', padding='same', input_shape=(299, 299, 3)))
model.add(layers.BatchNormalization())
model.add(layers.MaxPooling2D((2, 2), strides=2))

model.add(layers.Conv2D(64, (3, 3), activation='relu', padding='same'))
model.add(layers.BatchNormalization())
model.add(layers.MaxPooling2D((2, 2), strides=2))

model.add(layers.Conv2D(128, (3, 3), activation='relu', padding='same'))
model.add(layers.BatchNormalization())
model.add(layers.MaxPooling2D((2, 2), strides=2))

model.add(layers.Flatten())
model.add(layers.Dense(128, activation='relu'))
model.add(layers.Dropout(0.5))
model.add(layers.Dense(1, activation='sigmoid'))

return model

def main():
model = hic_v10_model()
model.compile(optimizer=tf.keras.optimizers.Adam(), loss='binary_crossentropy', metrics=['accuracy'])

img_path = 'path/to/image.jpg'  # Replace with the path to your input image
x = load_and_preprocess_image(img_path)
predictions = model.predict(x)

print('Predictions:', predictions[0])

if __name__ == '__main__':
main()
