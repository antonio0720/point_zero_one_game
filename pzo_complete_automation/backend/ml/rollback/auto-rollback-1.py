model_name = checkpoint_prefix + str(datetime.now().strftime("%Y%m%d-%H%M%S"))
model.save_weights(f"{checkpoint_dir}/{model_name}.h5")

def load_latest_model():
latest = tf.train.latest_checkpoint(checkpoint_dir)
model = models.load_model(latest, compile=False)
model.load_weights(latest + ".h5")
return model

kill_switch = False

def main():
if kill_switch:
print("Kill switch activated. Rolling back to the latest checkpoint.")
load_latest_model().save(f"{checkpoint_dir}/rollback-model.h5")

if __name__ == "__main__":
main()
```

This script defines a function `save_model` to save the model weights at specific intervals and a function `load_latest_model` to load the latest saved model. The variable `kill_switch` is a flag that, if set to True, will initiate a rollback by loading the latest checkpoint and saving it as "rollback-model.h5". The main function checks whether the script is run directly and, if so, activates the rollback if the kill switch is on.
