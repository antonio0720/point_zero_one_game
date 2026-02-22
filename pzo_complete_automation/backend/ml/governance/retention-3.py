now = datetime.datetime.now()
cutoff = now - datetime.timedelta(days=RETENTION_DAYS)

for filename in os.listdir(path):
file_path = os.path.join(path, filename)
if os.path.isfile(file_path):
file_time = datetime.datetime.fromtimestamp(os.path.getmtime(file_path))
if file_time < cutoff:
os.remove(file_path)
print(f'Deleted file {filename} at {file_path}')

if __name__ == "__main__":
delete_files('/your/data/directory')
```

Replace `/your/data/directory` with the path to your data directory. Adjust the `RETENTION_DAYS` variable as needed to set the desired retention period in days.
