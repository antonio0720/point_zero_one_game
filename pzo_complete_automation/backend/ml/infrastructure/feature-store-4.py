import boto3
import s3fs
import pandas as pd
import pyarrow.feather as feather
from awsglue.dynamicframe import DynamicFrame
from awsglue.context import GlueContext
from awsglue.job import Job

# Initialize session and context
session = boto3.Session(region_name='us-west-2')
glue_context = GlueContext(session)

# Create S3 FileSystem
s3fs = s3fs.S3FileSystem(anon=False, client=session.client('s3'))

# Define Feature Store path in S3 (root/feature-store/)
FEATURE_STORE_BUCKET = 'your-bucket'
FEATURE_STORE_PATH = 'root/feature-store/'

def create_or_update_feature(feature_name, df):
"""Save or update a feature using Feather format"""
feature_path = f"{FEATURE_STORE_PATH}{feature_name}.feather"

# Save DataFrame to S3 as Feather file
with s3fs.open(feature_path, mode='wb') as f:
feather.write_dataframe(df, f)

# Register the new feature in AWS Glue Data Catalog
glue_context.create_catalog_object(CatalogObjectIdentifier=feature_name,
database="default",
table_identifier=feature_name,
table_version='$LATEST',
description="Feature Store - " + feature_name,
storage_descriptor={
'location': s3fs.S3Key(FEATURE_STORE_BUCKET, feature_path),
'inputFormatClass': 'io.feather.arrow.ArrowFeatherInputFormat',
'outputFormatClass': 'io.feather.arrow.ArrowFeatherOutputFormat'})

def get_feature(feature_name):
"""Load a feature from S3 and AWS Glue Data Catalog"""
feature_path = f"{FEATURE_STORE_PATH}{feature_name}.feather"

# Get the table in AWS Glue Data Catalog
catalog = glue_context.get_catalog()
db = catalog.list_databases()[0]
table = catalog.get_table(db, feature_name)

# Load DataFrame from S3 using AWS Glue Data Catalog
df = DynamicFrame.fromDF(pd.read_feather(s3fs.open(feature_path)), glue_context)

return df

# Example usage: Create or update a feature (assuming you have a DataFrame `df` already)
create_or_update_feature('user-features', df)

# Example usage: Load a feature
user_features = get_feature('user-features')
