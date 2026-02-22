import cv2
import numpy as np
import os
import time
from PIL import Image

# Replace these paths with the actual paths to your reference images and templates
REFERENCE_IMG = "reference.png"
TEMPLATE_DIR = "templates/"
USER_CONFIRMATION_TEMPLATE = "user_confirmation_template.png"

def load_image(path):
return cv2.imread(path, cv2.IMREAD_GRAYSCALE)

def compare_images(ref, img):
# Replace this function with your own image comparison logic if needed
diff = cv2.absdiff(ref, img)
threshold, _ = cv2.threshold(diff, 50, 255, cv2.THRESH_BINARY)
return np.count_nonzero(threshold) / (ref.size * 0.1)

def create_user_confirmation_image(message):
user_conf_img = Image.open(USER_CONFIRMATION_TEMPLATE)
d = ImageDraw.Draw(user_conf_img)
font = ImageFont.truetype("arial.ttf", 20)
width, height = user_conf_img.size
text_width, text_height = d.textsize(message, font)
x, y = (width - text_width) / 2, (height - text_height) / 2
d.text((x, y), message, fill=(255, 255, 255), font=font)
return user_conf_img

def main():
reference = load_image(REFERENCE_IMG)
templates = [load_image(os.path.join(TEMPLATE_DIR, f)) for f in os.listdir(TEMPLATE_DIR) if f.endswith(".png")]

while True:
user_input_img = load_image(os.path.join("user_inputs", time.strftime("%Y%m%d_%H%M%S.png")))

for template in templates:
similarity = compare_images(reference, template)
if similarity < 0.2:  # Adjust this threshold as needed
print("Potential misclick detected!")
user_confirmation_img = create_user_confirmation_image("Is this a correct action? [Y/N]")
user_input = cv2.imread(user_confirmation_img, cv2.IMREAD_GRAYSCALE)

if compare_images(user_confirmation_img, user_input) < 0.5:  # Adjust this threshold as needed
print("User confirmed the misclick.")
# Perform actions to handle misclick here (e.g., send an alert, reset state, etc.)
else:
print("User denies the misclick. Ignoring.")

else:
print("No potential misclicks detected.")

if __name__ == "__main__":
main()
