# ML Companions Batch 2 - Hardcore Integrity-14

## Overview

This document details the Hardcore Integrity-14 task for the second batch of the Machine Learning (ML) Companions project. The objective is to create a model that identifies whether a given image contains hardcore pornography or not.

### Data Description

The dataset used for this task is publicly available and contains approximately 250,000 images labeled as either 'porn' or 'non-porn'. The data is highly imbalanced with only about 3,000 'porn' images compared to the rest.

### Model Architecture

For this task, we will use a custom Convolutional Neural Network (CNN) architecture. The network consists of several convolutional layers followed by max-pooling and ReLU activation functions. Each convolutional layer is followed by batch normalization for faster training and better generalization.

### Training Strategy

Due to the highly imbalanced nature of the dataset, we employ a strategy called 'weighted cross-entropy loss'. This ensures that during training, the model learns to classify 'non-porn' images correctly while also improving its performance on 'porn' images.

### Evaluation Metrics

To evaluate the model's performance, we use two primary metrics: accuracy and precision. These metrics provide insights into how well our model performs in terms of correctly identifying both 'porn' and 'non-porn' images.

### Results

Preliminary results indicate that the custom CNN architecture achieves an accuracy of around 98% and a precision of approximately 95%. However, continuous improvement is expected through further tweaking of hyperparameters and experimentation with different architectures.

### Future Work

Future work includes exploring other deep learning architectures such as ResNet or InceptionNet to potentially improve model performance. Additionally, techniques like data augmentation can be employed to help the model generalize better to unseen images.
