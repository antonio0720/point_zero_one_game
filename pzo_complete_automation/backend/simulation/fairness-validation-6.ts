const inputDataFilePath = path.resolve(__dirname, 'input_data.bin');
const outputDataGzipFilePath = path.resolve(__dirname, 'output_data.gz');
const validator = new FairnessValidator(inputDataFilePath, outputDataGzipFilePath);
validator.validate();
```

This code defines a `FairnessValidator` class that takes input and output data files as arguments. It loads the data points from these files, compares each input and output pair to check if they're equal, and finally prints whether the system is fair or not. The example usage shows how to create an instance of this class for given input and output data files.
