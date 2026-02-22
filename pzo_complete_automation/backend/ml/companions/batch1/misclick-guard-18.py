import keras
from keras.layers import Input, Dense, Flatten
from keras.models import Model
from keras.applications.resnet50 import ResNet50
from keras.preprocessing.image import load_img, img_to_array
from keras.utils import to_categorical
import numpy as np
import os

def preprocess_input(x):
x /= 255.
if len(x.shape) < 3:
x = np.expand_dims(x, axis=-1)
return x

model = ResNet50(weights='imagenet', include_top=False)

input_layer = Input(shape=(224, 224, 3))
x = model(preprocess_input(input_layer))
x = Flatten()(x)
output_layer = Dense(units=2, activation='softmax')(x)
model = Model(inputs=[input_layer], outputs=[output_layer])

classes = ['left', 'right']
train_data_dir = 'path/to/train/images'
val_data_dir = 'path/to/validation/images'
num_classes = len(classes)
batch_size = 32
epochs = 10

train_datagen = keras.preprocessing.image.ImageDataGenerator(rescale=1./255, validation_split=0.2)
train_generator = train_datagen.flow_from_directory(
train_data_dir, target_size=(224, 224), batch_size=batch_size, class_mode='categorical', classes=classes)
val_generator = train_datagen.flow_from_directory(
val_data_dir, target_size=(224, 224), batch_size=batch_size, shuffle=False, class_mode='categorical', classes=classes)

model.compile(loss='categorical_crossentropy', optimizer='adam', metrics=['accuracy'])
history = model.fit(train_generator, validation_data=val_generator, epochs=epochs)

def predict_direction(image_path):
img = load_img(image_path, target_size=(224, 224))
x = img_to_array(img).reshape((1, *img.shape[1:]))
x = np.expand_dims(x, axis=0)
x = preprocess_input(x)
preds = model.predict(x)[0]
if preds[1] > preds[0]:
return 'right'
else:
return 'left'
