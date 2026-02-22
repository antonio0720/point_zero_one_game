# Define the schema for our Feature Group
feature_group_schema = StructType([
StructField('user_id', IntegerType(), True),
StructField('timestamp', TimestampType(), True),
StructField('event', StringType(), True)
])

# Create a new database and table for the Feature Group
spark.sql("CREATE DATABASE IF NOT EXISTS feature_store")
spark.sql(f"USE feature_store")
spark.sql(f"CREATE TABLE IF NOT EXISTS user_events (\n"
f"  `user_id` INT,\n"
f"  `timestamp` TIMESTAMP,\n"
f"  `event` STRING\n"
f") USING feather")

# Define a function to save data to the Feature Store
def save_to_feature_store(df):
df.write.format("feather").save("user_events")

return save_to_feature_store, feature_group_schema

# Create a SparkSession
spark = SparkSession.builder \
.appName('Feature Store Example') \
.getOrCreate()

# Initialize the feature store functions and schema
save_to_feature_store, feature_group_schema = create_feature_store(spark)

# Example usage: read data, process it, and save to Feature Store
data = spark.createDataFrame([
(1, '2022-01-01', 'click'),
(2, '2022-01-02', 'purchase'),
(3, '2022-01-03', 'click')
], schema=StructType([
StructField('user_id', IntegerType(), True),
StructField('timestamp', DateType(), True),
StructField('event', StringType(), True)
]))

data = data.withColumn("timestamp", F.to_utc_timestamp(F.col("timestamp")))

save_to_feature_store(data)
```
