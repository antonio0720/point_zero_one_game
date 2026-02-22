from airflow import DAG
from airflow.operators.docker_operator import DockerOperator
from datetime import datetime, timedelta
from dags.helpers.constants import ML_IMAGES, MODEL_TRAINING_DOCKER_COMPOSE_FILE

default_args = {
'owner': 'airflow',
'depends_on_past': False,
'start_date': datetime(2021, 1, 1),
'email_on_failure': False,
'email_on_retry': False,
'retries': 1,
'retry_delay': timedelta(minutes=5)
}

dag = DAG('training-orchestration', default_args=default_args, schedule_interval=timedelta(days=1))

train_model = DockerOperator(
task_id='train_model',
image=ML_IMAGES['scikit-learn'],
api_version='auto',
auto_remove=True,
dockerfile=None,
command=[
'python', 'path/to/your_training_script.py'
],
docker_compose_file=MODEL_TRAINING_DOCKER_COMPOSE_FILE,
dag=dag,
)

start = DAG().get_default_task()
start >> train_model
