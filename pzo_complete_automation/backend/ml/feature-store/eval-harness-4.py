import argparse
import os
import sys
import logging
from typing import Dict, List, Union, Tuple, Any
import numpy as np
from sklearn.metrics import accuracy_score, precision_recall_fscore_support
from tensorflow.keras.models import load_model
from google.cloud import storage
from tqdm import tqdm

def get_args():
parser = argparse.ArgumentParser()
parser.add_argument('--model_path', type=str, required=True)
parser.add_argument('--input_data_bucket', type=str, required=True)
parser.add_argument('--output_data_bucket', type=str, required=True)
parser.add_argument('--train_file_prefix', type=str, required=True)
parser.add_argument('--eval_file_prefix', type=str, required=True)
parser.add_argument('--batch_size', type=int, default=32)
return parser.parse_args()

def load_data(input_bucket, prefix):
client = storage.Client()
bucket = client.get_bucket(input_bucket)
blobs = [blob for blob in tqdm(bucket.list_blobs(), desc=f"Loading data from {input_bucket}") if blob.name.startswith(prefix)]
X, y = [], []
for blob in blobs:
data = np.load(blob.download_as_string())
X.append(data['X'])
y.append(data['y'])
X = np.concatenate(X)
y = np.concatenate(y)
return X, y

def evaluate(model, X, y):
y_pred = model.predict(X)
acc = accuracy_score(y, y_pred)
prf = precision_recall_fscore_support(y, y_pred, average='weighted')
return {'accuracy': acc, 'precision': prf[0], 'recall': prf[1], 'f1-score': prf[2]}

def main():
args = get_args()
model = load_model(args.model_path)
X_train, y_train = load_data(args.input_data_bucket, f"{args.train_file_prefix}-")
X_eval, y_eval = load_data(args.input_data_bucket, f"{args.eval_file_prefix}-")

results = {}
results['train'] = evaluate(model, X_train, y_train)
results['eval'] = evaluate(model, X_eval, y_eval)

client = storage.Client()
bucket = client.get_bucket(args.output_data_bucket)
blob = bucket.blob("evaluation-results.json")
json_results = json.dumps(results)
blob.upload_from_string(json_results)
logging.info(f"Evaluation results saved to {blob.name}")

if __name__ == "__main__":
main()
