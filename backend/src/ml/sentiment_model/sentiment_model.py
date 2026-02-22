from transformers import DistilBertForSequenceClassification, Trainer, TrainingArguments
import torch

class SentimentModel:
    def __init__(self):
        self.model = DistilBertForSequenceClassification.from_pretrained('distilbert-base-uncased')
        self.to_device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    def train(self, training_data):
        training_args = TrainingArguments(
            output_dir='./model',
            num_train_epochs=3,
            per_device_train_batch_size=64,
            weight_decay=0.01,
            logging_dir='./logs',
            logging_steps=1000,
            save_steps=5000,
        )

        trainer = Trainer(
            model=self.model,
            args=training_args,
            train_dataset=training_data,
            compute_metrics='accuracy'
        )

        trainer.train()

    def predict(self, inputs):
        inputs = torch.tensor([inputs], device=self.to_device)
        outputs = self.model(inputs)[0]
        _, predicted = torch.max(outputs.data, 1)
        return predicted.item()
