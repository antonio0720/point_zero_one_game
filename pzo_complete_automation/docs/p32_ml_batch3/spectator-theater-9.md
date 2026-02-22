Spectator Theater 9 (ST9) for Machine Learning Companions Batch 3
==================================================================

Overview
--------

Spectator Theater 9 (ST9) is a tool designed to facilitate the evaluation of machine learning models in a competitive and interpretable manner. It is part of the Machine Learning Companions Batch 3. ST9 allows users to compare multiple models, visualize their performance, and gain insights into their strengths and weaknesses.

Getting Started
---------------

To get started with Spectator Theater 9, follow these steps:

1. Install Spectator Theater 9 by running the following command in your terminal or command prompt:
```
pip install spectator-theater-9
```
2. Import the necessary libraries in your Python script:
```python
from spectator_theater_9 import ST9
import pandas as pd
import numpy as np
```
3. Prepare your data as a Pandas DataFrame, with columns for predictions (`y_pred`) and true labels (`y_true`).
4. Instantiate the `ST9` class and provide your prepared data:
```python
st = ST9(data)
```
5. Train your machine learning models on the training data, and evaluate them on the test data to obtain predictions and true labels.
6. Add each model as a participant in the `ST9` instance:
```python
st.add_participant('Model 1', y_pred=model1_predictions)
st.add_participant('Model 2', y_pred=model2_predictions)
# ... add more models as needed
```
7. Visualize the performance of each model using various metrics and visualizations:
```python
st.show()
```
Metrics and Visualizations
--------------------------

Spectator Theater 9 provides several metrics to evaluate the performance of machine learning models, including:

- Accuracy
- Precision
- Recall
- F1 Score
- Confusion Matrix
- ROC Curve
- Precision-Recall Curve

In addition, ST9 offers various visualizations to help interpret the results and understand the strengths and weaknesses of each model.

Examples
--------

To see how Spectator Theater 9 can be used in practice, check out the following examples:

- [Iris dataset example](https://github.com/microsoft/ML-Companions/blob/main/batch3/spectator_theater_examples/iris_example.ipynb)
- [Wine dataset example](https://github.com/microsoft/ML-Companions/blob/main/batch3/spectator_theater_examples/wine_example.ipynb)

Contributing
------------

If you find any issues or have suggestions for improvements, please open an issue on the [GitHub repository](https://github.com/microsoft/ML-Companions). Contributions are welcome!

License
-------

Spectator Theater 9 is released under the MIT License. See the [LICENSE](https://github.com/microsoft/ML-Companions/blob/main/batch3/spectator_theater/LICENSE) file for more details.
