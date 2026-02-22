import random
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import linear_kernel
from nltk.corpus import wordnet as wn
from collections import Counter

def get_synonyms(word):
synonyms = []
for syn in wn.synsets(word):
for lemma in syn.lemmas():
synonyms.append(lemma.name())
return synonyms

def preprocess_data(questions, choices):
question_vectors = []
choice_vectors = []

for question, choices in zip(questions, choices):
question_vec = []
choice_vecs = []

question_words = question.split()
question_synonyms = [get_synonyms(word) for word in question_words]
question_words = [word for syn in question_synonyms for word in syn]

choice_words = [choice.strip() for choice in choices.split(";")]
choice_synonyms = [get_synonyms(word) for word in choice_words]
choice_words = [word for syn in choice_synonyms for word in syn]

question_vec += question_words
choice_vecs += choice_words

vectorizer = TfidfVectorizer()
question_vector = vectorizer.fit_transform([question])[0]
choice_vectors += [choice_vector for _ in range(len(choices.split(";")))]

question_vectors.append(question_vec)
choice_vectors = list(set(choice_vectors))

return question_vectors, Counter(choice_vectors)

def calculate_scores(question_vector, choice_vectors, choice_counts):
scores = []
for choice in choice_vectors:
score = linear_kernel([question_vector], [choice])
scores.append((score, choice_counts[choice]))

scores = sorted(scores, key=lambda x: x[0], reverse=True)
return scores

def generate_drill(questions, choices, num_choices, personalization_factor):
question_vectors, choice_counts = preprocess_data(questions, choices)

drills = []

for i in range(num_choices):
question = random.choice(question_vectors)
scores = calculate_scores(question, choice_vectors, choice_counts)

personalized_choice = None
if personalization_factor > 0:
personalized_score = random.uniform(0, 1)
total_personalized_score = sum([score[0] * score[1] for score in scores])

personalized_index = int((personalized_score / total_personalized_score) * len(scores))
personalized_choice = scores[personalized_index][1]

if personalized_choice:
drills.append({"question": question, "correct_answer": personalized_choice})
else:
drills.append({"question": question, "correct_answer": random.choice(scores)[1]})

return drills
