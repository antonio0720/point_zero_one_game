response = s3.list_buckets()
buckets = [bucket['Name'] for bucket in response['Buckets']]
return buckets

def get_file_list(bucket_name):
prefix = 'path/to/your/data/'
keys = s3.list_objects_v2(Bucket=bucket_name, Prefix=prefix)['Contents']
files = [{'Key': key['Key'], 'LastModified': key['LastModified']} for key in keys]
return files

def apply_retention_policy(files):
current_date = datetime.utcnow()
retention_period = timedelta(days=182)  # 6 months in days

to_delete = []
for file in files:
if (current_date - file['LastModified']) > retention_period:
to_delete.append({'Bucket': file['Bucket'], 'Key': file['Key']})

return to_delete

def delete_files(to_delete):
for data in to_delete:
s3.delete_objects(Bucket=data['Bucket'], Delete={'Objects': [{'Key': data['Key']}]})

buckets = get_bucket_list()
for bucket in buckets:
files = get_file_list(bucket)
to_delete = apply_retention_policy(files)
delete_files(to_delete)
```
