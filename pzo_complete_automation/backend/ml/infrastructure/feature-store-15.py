return EntityDef(id_field="example_id", entity_name=entity_name)

def create_feature_view(view_name: str, entity_def: EntityDef) -> FeatureView:
return FeatureView(
name=view_name,
entities=[entity_def],
features={
"example_feature": TimeSeriesFeat(id="example_feature", source=FileSource("gs://{bucket}/{entity}/{feature}.parquet"))
},
time_range={'past_days': 7, 'future_days': 30},
)

def upload_to_gcs(bucket: str, entity_name: str, feature_name: str, file_path: str):
client = storage.Client()
bucket = client.get_bucket(bucket)
blob = bucket.blob(f"{entity_name}/{feature_name}.parquet")
blob.upload_from_filename(file_path)

def init():
session = CoreSession(project=project_id, service_account_file="path/to/service-account.json")

user_entity = create_entity("users")
user_view = create_feature_view("user_views", user_entity)
session.create_feature_view(user_view)

movie_entity = create_entity("movies")
movie_view = create_feature_view("movie_views", movie_entity)
session.create_feature_view(movie_view)

user_features_file_path = "data/users/user_features.parquet"
movie_features_file_path = "data/movies/movie_features.parquet"
upload_to_gcs(featurestore_bucket_name, "users", "user_features", user_features_file_path)
upload_to_gcs(featurestore_bucket_name, "movies", "movie_features", movie_features_file_path)

if __name__ == "__main__":
init()
```
