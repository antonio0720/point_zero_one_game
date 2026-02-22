# ML Companions Batch 3 - Counterparty Freeze-15

## Overview

This document provides details about the Counterparty Freeze-15 task in the third batch of the ML Companions project.

## Task Description

The goal is to develop a machine learning model that can accurately predict whether a given counterparty will freeze within the next 30 days based on historical data. The prediction should be made using a binary classification approach, where 1 indicates the counterparty will freeze and 0 indicates otherwise.

## Data Description

The dataset contains features related to the counterparties such as:

- Counterparty ID
- Previous Freeze Status
- Number of Transactions
- Average Transaction Value
- Maximum Transaction Value
- Minimum Transaction Value
- Standard Deviation of Transaction Values
- Median Transaction Value
- Total Amount Transacted
- Date of Last Transaction
- Days Since Last Transaction

## Evaluation Metrics

The model will be evaluated based on the following metrics:

1. Accuracy
2. Precision
3. Recall
4. F1 Score
5. Area Under ROC Curve (AUROC)
6. Confusion Matrix

## Submission Guidelines

Your submission should include:

- A Jupyter notebook containing the code for model training and prediction
- A brief report explaining your approach, the chosen machine learning algorithm(s), and the results obtained
- Predictions in a CSV file with two columns: Counterparty ID and Freeze Status (1 or 0)

## Important Dates

- **Submission Deadline**: [Insert Date]
- **Results Announcement**: [Insert Date]
