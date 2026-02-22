import boto3
import os

s3 = boto3.client('s3')
bucket_name = 'your-bucket-name'
prefix = 'path/to/data/'

def delete_s3_objects(key_list):
for key in key_list:
try:
s3.delete_objects(Bucket=bucket_name, Delete={
'Objects': [{
'Key': key
}]
})
except Exception as e:
print(f'Error deleting object {key}: {e}')

def get_s3_object_keys(prefix):
response = s3.list_objects_v2(Bucket=bucket_name, Prefix=prefix)
keys = []
for content in response['Contents']:
keys.append(content['Key'])
return keys

def main():
delete_keys = get_s3_object_keys(prefix)
if len(delete_keys) > 50:
print('Too many objects to delete at once, break into smaller batches')
delete_in_batches(delete_keys, 50)
else:
delete_s3_objects(delete_keys)

def delete_in_batches(keys, batch_size):
for i in range(0, len(keys), batch_size):
delete_s3_objects(keys[i:i+batch_size])

if __name__ == "__main__":
main()
