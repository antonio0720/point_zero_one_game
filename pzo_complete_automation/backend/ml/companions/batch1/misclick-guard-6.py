import tkinter as tk
from PIL import ImageGrab
import tensorflow as tf
import numpy as np

model = tf.keras.models.load_model('misclick_guard_model.h5')

class MisclickGuard(tk.Frame):
def __init__(self, master=None):
super().__init__(master)
self.master = master
self.master.title("Misclick Guard")
self.pack(fill=tk.BOTH, expand=True)

self.img = tk.PhotoImage(ImageGrab.grab())
self.label = tk.Label(self, image=self.img)
self.label.pack(side=tk.TOP, fill=tk.BOTH, expand=True)

self.canvas = tk.Canvas(self, width=self.img.width(), height=self.img.height())
self.canvas.pack(side=tk.BOTTOM, fill=tk.BOTH, expand=True)
self.canvas.create_image((self.img.width() / 2, self.img.height() / 2), image=self.img)

self.screen_width = self.master.winfo_screenwidth()
self.screen_height = self.master.winfo_screenheight()

self.bind('<Motion>', self.on_motion)
self.bind('<Button-1>', self.on_click)

def preprocess(self, image):
image = np.asarray(image, dtype=np.float32) / 255.0
image = np.expand_dims(image, axis=0)
return image

def on_motion(self, event):
x, y = event.x, self.screen_height - event.y
if x < self.screen_width / 2 and y > self.screen_height / 2:
self.canvas.create_rectangle((event.x, event.y), (event.x + 10, event.y + 10), fill='red')
else:
self.canvas.delete('all')

def on_click(self, event):
x, y = event.x, self.screen_height - event.y
screen_img = ImageGrab.grab((x-10, y-10, x+10, y+10))
preprocessed_img = self.preprocess(screen_img)
prediction = model.predict(preprocessed_img).round()

if prediction[0] == 1:
print("Potential misclick detected!")

self.label.image = ImageTk.PhotoImage(screen_img)
self.label.config(width=screen_img.width(), height=screen_img.height())
self.canvas.create_image((self.img.width() / 2, self.img.height() / 2), image=self.label.image)

root = tk.Tk()
app = MisclickGuard(root)
root.mainloop()
