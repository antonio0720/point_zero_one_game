import os
import sys
import time
import argparse
import requests
from PIL import Image
from io import BytesIO
from collections import deque

# Global Variables
BASE_URL = "http://localhost:8000/misclick"  # Replace with the API endpoint URL
MAX_QUEUE_SIZE = 100

def preprocess(image):
"""Pre-processing of the image for sending to the server"""
(img_w, img_h) = image.size
aspect_ratio = img_h / float(img_w)
if aspect_ratio > 1.5:
img = image.resize((int(img_w * 1.5), int(img_h * 1.5)))
elif aspect_ratio < 0.67:
img = image.resize((int(img_w / 1.5), int(img_h / 1.5)))
return img

def get_prediction(image):
"""Sending the pre-processed image to the server and receiving prediction"""
image_data = BytesIO()
image.save(image_data, format="JPEG")
image_data.seek(0)
response = requests.post(BASE_URL, files={'file': image_data})
return response.json()['prediction']

def main():
"""Main function to start the misclick guard"""
parser = argparse.ArgumentParser(description="Misclick Guard")
parser.add_argument("--screen-shot", type=str, required=True)

args = parser.parse_args()

with Image.open(args.screen_shot) as img:
prediction = get_prediction(preprocess(img))

if prediction == "misclick":
print("MISCLICK DETECTED!")
os._exit(1)

if __name__ == "__main__":
main()
