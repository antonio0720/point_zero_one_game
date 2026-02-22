import os
import sys
import time
import cv2
import numpy as np
import keyboard
from PIL import ImageGrab
from pynput import mouse

THRESHOLD = 0.3
CLICK_DELAY = 0.1
PREVIOUS_POSITION = None

def on_click(x, y, button, pressed):
if pressed:
global PREVIOUS_POSITION
PREVIOUS_POSITION = (x, y)

mouse_listener = mouse.Listener(on_click=on_click)
mouse_listener.start()

def screenshot():
img = ImageGrab.grab()
return np.array(img)

def get_dist_from_prev(img):
dist = np.linalg.norm(np.array(img.shape[:2]) - np.array(PREVIOUS_POSITION))
return int(dist * THRESHOLD)

def check_for_misclick():
current_position = mouse.get_position()
if PREVIOUS_POSITION:
dist = get_dist_from_prev(screenshot())
if dist < 5:
keyboard.send('{BACKSPACE}')
time.sleep(CLICK_DELAY)

def main():
while True:
check_for_misclick()
time.sleep(0.1)

if __name__ == "__main__":
main()
