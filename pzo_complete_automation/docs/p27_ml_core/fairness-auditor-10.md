# Fairness Auditor (Version 10)

A comprehensive guide to using the Fairness Auditor Version 10 in Machine Learning Core (ML Core).

## Overview

The Fairness Auditor Version 10 is a powerful tool designed to assess and ensure fairness within machine learning models. It provides insights into potential biases in the model's predictions, helping to maintain unbiased and equitable outcomes.

## Installation

To install the Fairness Auditor (Version 10), use the following command:

```bash
pip install mlcore-fairness-auditor==10
```

## Usage

The Fairness Auditor can be used with various ML Core models. To audit a model, follow these steps:

1. Import necessary libraries:

```python
from mlcore.models import YourModel
from mlcore.fairness_auditor import FairnessAuditor
```

Replace `YourModel` with the specific machine learning model you are using (e.g., LogisticRegression, DecisionTreeClassifier, etc.).

2. Train your model:

```python
X_train, y_train = load_data()  # Load your training data
model = YourModel()             # Initialize the model
model.fit(X_train, y_train)     # Train the model on the data
```

3. Create a Fairness Auditor instance:

```python
auditor = FairnessAuditor(model)
```

4. Perform the fairness audit:

The `FairnessAuditor` class provides several methods to assess fairness based on different metrics (e.g., demographic parity, equal opportunity, etc.). To calculate these metrics for a specific sensitive attribute and protected group:

```python
fairness_metrics = auditor.evaluate(sensitive_attribute='race', protected_group='minority')
```

Replace `race` and `minority` with the appropriate sensitive attribute and protected group for your specific use case. The `fairness_metrics` object contains detailed fairness statistics.

5. Interpret results:

Inspect the results from the fairness audit to identify potential biases and adjust your model accordingly.

## Available Fairness Metrics

The Fairness Auditor supports several common fairness metrics, including:

- **Demographic Parity (DP)**: The proportion of protected group members that have a positive outcome compared to non-protected group members.
- **Equal Opportunity (EO)**: The difference in true positive rates for the protected and non-protected groups.
- **Equalized Odds (EOdds)**: The condition where DP and EO are satisfied simultaneously, ensuring that the probability of a positive prediction is equal for both groups.
- **Conditional Average Treatment Effect (CATE)**: Measures the difference in expected outcomes between protected and non-protected group members given similar feature values.

## Additional Resources

For more information on the Fairness Auditor and ML Core, please refer to the [official documentation](https://mlcore.readthedocs.io). If you encounter any issues or have questions, feel free to open an issue on the [ML Core GitHub repository](https://github.com/mlcore-org/mlcore).
