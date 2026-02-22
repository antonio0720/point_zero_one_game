import React from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

const BootRun9 = () => {
const { t } = useTranslation();
const [step, setStep] = useState(0);
const [answers, setAnswers] = useState([]);

const questions = [
{
question: t('questions.bootRun9.question1'),
answers: [
{ text: t('questions.bootRun9.answerA1'), isCorrect: false },
{ text: t('questions.bootRun9.answerB1'), isCorrect: true },
{ text: t('questions.bootRun9.answerC1'), isCorrect: false }
]
},
{
question: t('questions.bootRun9.question2'),
answers: [
{ text: t('questions.bootRun9.answerA2'), isCorrect: true },
{ text: t('questions.bootRun9.answerB2'), isCorrect: false },
{ text: t('questions.bootRun9.answerC2'), isCorrect: false }
]
},
// Add more questions as needed
];

const handleAnswerClick = (index: number) => () => {
setAnswers((prevAnswers) => [...prevAnswers, questions[step].answers[index]]);
if (step < questions.length - 1) {
setStep(step + 1);
} else {
// Redirect to the results page or provide feedback after all questions are answered
}
};

return (
<div>
{step < questions.length ? (
<>
<h2>{questions[step].question}</h2>
<ul>
{questions[step].answers.map((answer, index) => (
<li key={index}>
<button onClick={handleAnswerClick(index)}>{answer.text}</button>
</li>
))}
</ul>
</>
) : (
// Display results or feedback based on the answers provided
)}
</div>
);
};

export default BootRun9;
