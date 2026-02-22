train_datagen = ImageDataGenerator(
rescale=1. / 255,
validation_split=0.2
)

train_ds = train_datagen.flow_from_directory(
'train',
target_size=(IMG_WIDTH, IMG_HEIGHT),
batch_size=BATCH_SIZE,
class_mode='binary'
)

valid_ds = train_datagen.flow_from_directory(
'val',
target_size=(IMG_WIDTH, IMG_HEIGHT),
batch_size=BATCH_SIZE,
class_mode='binary'
)

return train_ds, valid_ds

def create_model():
inputs = Input(shape=(IMG_WIDTH, IMG_HEIGHT, 3))
x = layers.Conv2D(64, (3, 3), activation='relu', padding='same')(inputs)
x = layers.MaxPooling2D((2, 2))(x)
x = layers.Conv2D(128, (3, 3), activation='relu', padding='same')(x)
x = layers.MaxPooling2D((2, 2))(x)
x = layers.Conv2D(256, (3, 3), activation='relu', padding='same')(x)
x = layers.Conv2D(256, (3, 3), activation='relu', padding='same')(x)
x = layers.MaxPooling2D((2, 2))(x)
x = layers.Flatten()(x)
x = layers.Dense(128, activation='relu')(x)
outputs = layers.Dense(1, activation='sigmoid')(x)

model = models.Model(inputs=inputs, outputs=outputs)

return model

def main():
model = create_model()
train_ds, valid_ds = create_dataset()

model.compile(loss='binary_crossentropy', optimizer='adam', metrics=['accuracy'])
history = model.fit(
train_ds,
validation_data=valid_ds,
epochs=EPOCHS
)

if __name__ == '__main__':
main()
```
