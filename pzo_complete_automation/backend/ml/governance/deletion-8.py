import pandas as pd

def delete_rows(df, conditions):
filtered_df = df[~df.apply(lambda row: any(cond not met for cond in conditions), axis=1)]
return filtered_df

def apply_conditions(dataframe, condition_functions):
for func in condition_functions:
dataframe = func(dataframe)
return dataframe

def delete_columns(df, column_names):
df = df.drop(columns=column_names)
return df

def main():
data = pd.read_csv("path/to/your/dataset.csv")

condition_functions = [
lambda df: df[df['column1'] < some_value],
lambda df: df[df['column2'].isnull()],
# add more conditions as needed
]
conditioned_data = apply_conditions(data, condition_functions)

column_names_to_delete = ['column3', 'column4']
deleted_columns_data = delete_columns(conditioned_data, column_names_to_delete)

rows_to_delete = [6, 12, 25]
cleaned_data = delete_rows(deleted_columns_data, rows_to_delete)

cleaned_data.to_csv("path/to/output/dataset.csv", index=False)

if __name__ == "__main__":
main()
