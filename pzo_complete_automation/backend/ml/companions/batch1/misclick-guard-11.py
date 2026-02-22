import numpy as np
from tensorflow.keras.models import load_model

model = load_model('path/to/misclick_guard_model.h5')

def misclick_guard(user_input, user_context):
input_data = np.array([user_input, user_context]).reshape(1, -1)
predictions = model.predict(input_data)
is_misclick = predictions[0] > 0.5
return is_misclick
