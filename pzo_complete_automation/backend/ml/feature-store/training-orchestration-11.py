from airflow import DAG
from airflow.providers.dvc.operators.dvc_run import DVCRunOperator
from datetime import timedelta, datetime

default_args = {
'owner': 'airflow',
}

dag = DAG(
'training-orchestration',
default_args=default_args,
schedule_interval=timedelta(days=1),
)

with dag:
init = DVCRunOperator(
task_id='init',
command='dvc init',
dvc_opts={'force': True},
dag=dag,
)

pull = DVCRunOperator(
task_id='pull',
command='dvc pull',
dag=dag,
on_failure_callback=init,
)

train = DVCRunOperator(
task_id='train',
command='python train.py',
dvc_opts={'force': True},
dag=dag,
on_success_callback=pull,
)

deploy = DVCRunOperator(
task_id='deploy',
command='python deploy.py',
dvc_opts={'force': True},
dag=dag,
on_success_callback=train,
)
