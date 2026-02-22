Choice Drill Generator (v0.19)
==============================

A machine learning based choice drill generator for enhancing language proficiency through personalized exercises.

Table of Contents
------------------

* [Introduction](#introduction)
* [Installation](#installation)
* [Usage](#usage)
+ [Generating Choice Drills](#generating-choice-drills)
+ [Personalizing Drills](#personalizing-drills)
* [Model Architecture](#model-architecture)
* [Evaluation and Results](#evaluation-and-results)
* [Contributing](#contributing)
* [License](#license)

<a name="introduction"></a>

### Introduction

The Choice Drill Generator is a machine learning tool designed to create personalized language exercises in the form of choice drills. The system uses reinforcement learning algorithms to optimize the difficulty level and content of the exercises based on user responses, promoting active engagement and enhancing language proficiency.

<a name="installation"></a>

### Installation

To set up the Choice Drill Generator, follow these steps:

1. Clone the repository:

```bash
git clone https://github.com/your-username/choice-drill-generator.git
cd choice-drill-generator
```

2. Install required packages:

```bash
pip install -r requirements.txt
```

<a name="usage"></a>

### Usage

The Choice Drill Generator consists of two main components: a generator for creating choice drills and a module for personalizing the difficulty level and content of the exercises based on user responses.

#### Generating Choice Drills

After setting up the environment, you can generate a new set of choice drills using the following command:

```bash
python create_choice_drills.py --num-drills <number>
```

Replace `<number>` with the desired number of choice drills to be generated. The output will be saved as a CSV file in the project root directory.

#### Personalizing Drills

To personalize the generated choice drills based on user responses, you can use the `personalize_drills.py` script:

```bash
python personalize_drills.py --input-file <csv-file> --output-file <output-csv>
```

Replace `<csv-file>` with the path to the generated choice drills CSV file and `<output-csv>` with the desired output file path.

<a name="model-architecture"></a>

### Model Architecture

The Choice Drill Generator uses a reinforcement learning model based on the Deep Q Network (DQN) architecture to optimize the difficulty level and content of the exercises. The model learns from user responses and continuously improves its ability to create personalized language exercises.

<a name="evaluation-and-results"></a>

### Evaluation and Results

Evaluation results and performance metrics for the Choice Drill Generator can be found in the `results/` directory within the project root folder. The evaluation process involves testing the system with a set of predefined user responses and comparing its output to a set of manually created, optimized choice drills.

<a name="contributing"></a>

### Contributing

Contributions to the Choice Drill Generator are welcome! Please follow these steps:

1. Fork the repository
2. Create a new branch for your feature or fix
3. Commit and push changes to your branch
4. Submit a pull request

<a name="license"></a>

### License

The Choice Drill Generator is released under the [MIT License](LICENSE).
