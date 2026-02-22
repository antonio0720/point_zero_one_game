__tablename__ = 'data'
id = column(INTEGER, primary_key=True)
created_at = column(DATETIME)
data_type = column(STRING)

engine = create_engine('postgresql://user:password@localhost/dbname')
Session = sessionmaker(bind=engine)

def after_commit(session, scope, extension):
for observer in extension.after_commit_observers:
observer(session, scope)

event.listen(Session, 'after_commit', after_commit)

def delete_old_data(session, days=30):
now = datetime.utcnow()
cutoff = now - timedelta(days=days)
session.query(Data).filter(Data.created_at < cutoff).delete(synchronize_session='fetch')

def save_data(data, data_type):
with Session() as session:
new_data = Data(created_at=datetime.utcnow(), data_type=data_type)
session.add(new_data)
session.commit()

if __name__ == '__main__':
# Example usage
save_data('example_data', 'example_type')
delete_old_data()
```

This script defines a Data model and sets up an SQLAlchemy session for interacting with the database. It includes a method to save new data, `save_data`, and another method to delete old data based on retention days, `delete_old_data`. The script also listens for after-commit events so that any changes in the session are immediately reflected in the database.
