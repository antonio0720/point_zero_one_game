import os
import sys
import dvc
from dvc.exceptions import DVCAmbiguousRemoteException

def initialize_dvc(repo_dir):
dvc.main(['init', repo_dir])

def add_data(repo_dir, data_path):
dvc.add([data_path], force=True, commit=False)
dvc.commit('Add data')

def pull_data(repo_dir):
try:
dvc.main(['pull'])
except DVCAmbiguousRemoteException as e:
print(e)
print("Unable to pull data. Check remote and local branches.")
sys.exit(1)

def commit_and_push(repo_dir, message):
dvc.commit(message=message)
dvc.main(['push'])

if __name__ == '__main__':
if len(sys.argv) < 3:
print('Usage: python script.py [repo_directory] [data_path]')
sys.exit(1)

repo_dir = sys.argv[1]
data_path = sys.argv[2]

if not os.path.exists(repo_dir):
print('Error: Repository directory does not exist.')
sys.exit(1)

initialize_dvc(repo_dir)
add_data(repo_dir, data_path)
commit_and_push(repo_dir, 'Initial commit of data')
