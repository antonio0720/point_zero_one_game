timestamp: str
feature_1: float
feature_2: float
label: float

def load_data(filepath: str) -> pd.DataFrame:
return pd.read_csv(filepath, parse_dates=['timestamp'])

def filter_old_data(df: pd.DataFrame) -> pd.DataFrame:
cutoff = datetime.now() - timedelta(days=5)
return df[df['timestamp'] >= cutoff]

def save_data(data: Union[pd.DataFrame, List[DataRecord]], filepath: str):
if isinstance(data, pd.DataFrame):
data.to_csv(filepath, index=False)
elif isinstance(data, list):
df = pd.DataFrame(data, columns=[col.name for col in DataRecord.__annotations__.values()])
df.to_csv(filepath, index=False)

def main():
data_filepath = 'data/raw_data.csv'
processed_data_filepath = 'data/processed_data.csv'

raw_data = load_data(data_filepath)
filtered_data = filter_old_data(raw_data)
save_data(filtered_data, processed_data_filepath)

if __name__ == "__main__":
main()
```

This script loads CSV data, filters out records older than 5 days, and saves the filtered data to a new CSV file. Replace `'data/raw_data.csv'` and `'data/processed_data.csv'` with your own filenames for input and output files respectively.
