# Emergency Liquidity (ML Companions Batch 1 - Problem 9)

This document outlines the ninth problem in the Machine Learning (ML) Companions Batch 1 series, focusing on the Emergency Liquidity scenario.

## Problem Statement

In this problem, we are given a dataset containing financial information about banks, including their asset quality, liquidity position, and capitalization. The goal is to predict whether a bank will face an emergency liquidity need within the next 3 months based on its current financial state.

## Data Description

The dataset provided includes the following features:

1. BankID (unique identifier for each bank)
2. AssetQualityRatio (ratio of quality assets to total assets)
3. LiquidityPositionRatio (ratio of liquid assets to total assets)
4. CapitalizationRatio (ratio of capital to total assets)
5. NumberOfEmployees
6. Loans (total number of loans given by the bank)
7. Deposits (total amount deposited in the bank)
8. Target (binary label indicating if the bank faced an emergency liquidity need within 3 months)

## Evaluation Metrics

The performance will be evaluated using the following metrics:

1. Accuracy
2. Precision
3. Recall
4. F1-Score
5. AUC-ROC (Area Under the Receiver Operating Characteristic Curve)

## Model Architecture

To solve this problem, you can choose any Machine Learning algorithm that suits your needs. Common choices include Logistic Regression, Decision Trees, Random Forests, Support Vector Machines, and Neural Networks.

## Steps to Solve the Problem

1. Load and preprocess the dataset.
2. Explore and understand the data by visualizing key features.
3. Perform necessary feature engineering if needed (e.g., normalization).
4. Train, validate, and test different Machine Learning algorithms.
5. Evaluate the performance of each model using the provided metrics.
6. Choose the best-performing model based on your evaluation criteria.
7. Fine-tune the hyperparameters to further improve the model's performance.
8. Save the final model for deployment.

## Resources

Here are some resources that might help you in solving this problem:

1. [Scikit-learn](https://scikit-learn.org/stable/) - A popular Python library for Machine Learning.
2. [Seaborn](https://seaborn.pydata.org/) - A visualization library for Python, built on Matplotlib.
3. [Pandas](https://pandas.pydata.org/) - A powerful data manipulation and analysis library in Python.
