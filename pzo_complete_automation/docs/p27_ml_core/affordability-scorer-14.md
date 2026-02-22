Affordability Scorer-14
=======================

Overview
--------

The Affordability Scorer-14 is a machine learning model developed to predict the affordability of a housing unit based on various economic and demographic factors. This model uses gradient boosting machines (GBM) as its core algorithm, with 14 features as input.

Features
--------

1. **Household Income**: The total annual income of the household.
2. **Down Payment**: The amount of money a buyer has saved for an initial payment on a property.
3. **Loan Amount**: The total amount borrowed from a lender to purchase a home.
4. **Debt-to-Income Ratio (DTI)**: A measure of the debt relative to income, calculated as monthly debt payments divided by gross monthly income.
5. **Monthly Housing Costs (MHC)**: The total monthly costs associated with owning a home, including mortgage payment, insurance, taxes, and utilities.
6. **Total Debt**: The sum of all recurring monthly payments, such as car loans, student loans, credit card debt, etc.
7. **Credit Score**: A numerical representation of a borrower's creditworthiness based on their credit history.
8. **Employment Duration**: Length of time the applicant has been with their current employer.
9. **Monthly Income Change**: Changes in monthly income over the past 12 months.
10. **Monthly Expenses Change**: Changes in monthly expenses over the past 12 months.
11. **Gender**: The applicant's gender, used as a proxy for certain demographic factors.
12. **Age**: The age of the applicant.
13. **Marital Status**: Whether the applicant is married or not, used as a proxy for family size and potential expenses.
14. **Education Level**: The highest level of education completed by the applicant.

Training Data
-------------

The Affordability Scorer-14 was trained on a large dataset of housing loan applications, consisting of over 100,000 instances with known outcomes (affordable or not affordable). The data was collected from multiple sources and preprocessed to ensure consistency and accuracy.

Performance Metrics
--------------------

The model's performance is evaluated using the Area Under the Receiver Operating Characteristic Curve (AUC-ROC) and the F1-score. During training, the AUC-ROC was consistently above 0.85, indicating good separation between affordable and not affordable applications. The F1-score varied depending on the dataset but averaged around 0.80.

Usage
-----

To use the Affordability Scorer-14 for predicting the affordability of a housing unit, follow these steps:

1. Install the required dependencies (scikit-learn and pandas).
2. Load the trained model using `pickle.load()`.
3. Prepare your data in a pandas DataFrame with the same column names as the features listed above.
4. Reshape the DataFrame to have one row per application, if necessary.
5. Make predictions by calling the `predict` method on the loaded model, passing your prepared data as input.
6. Interpret the output as follows:
- A score of 0 indicates that the housing unit is not affordable.
- A score closer to 1 suggests a higher likelihood of affordability.

Example Code Snippet
---------------------

```python
from sklearn.externals.joblib import load
import pandas as pd

# Load the model
model = load('affordability_scorer_14.pkl')

# Prepare your data (replace colnames with actual column names in your dataset)
data = {
'Household_Income': [50000, 60000],
'Down_Payment': [20000, 30000],
# ... continue filling the DataFrame with your data
}
df = pd.DataFrame(data)

# Make predictions
predictions = model.predict(df)
print(predictions)
```
