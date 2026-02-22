import random
import numpy as np

def choice_drill_generator(student, question_bank, num_questions):
# Filter questions based on student's current knowledge level
filtered_questions = [q for q in question_bank if q['difficulty'] <= student.current_level]

# Sort questions by difficulty level (easier questions first)
sorted_questions = sorted(filtered_questions, key=lambda x: x['difficulty'])

drill = []

# Generate the choice drill with the specified number of questions
for _ in range(num_questions):
question = random.choice(sorted_questions)
correct_answer_index = np.random.randint(0, len(question['choices']))
question['correct_answer'] = question['choices'].pop(correct_answer_index)
question['choices'] = tuple(question['choices'])  # Convert list to tuple for immutability
drill.append(question)
sorted_questions.remove(question)  # Remove the used question from the pool

return drill
