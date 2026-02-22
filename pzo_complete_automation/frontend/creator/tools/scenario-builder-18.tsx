import * as React from 'react';
import { Formik, Field, Form, ErrorMessage } from 'formik';
import * as yup from 'yup';
import styles from './ScenarioBuilder.module.scss';
import { ScenarioData } from '../../interfaces/ScenarioData';
import ScenarioItem from '../ScenarioItem';
import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';

const schema = yup.object().shape({
scenarios: yup.array().of(yup.object().shape({
id: yup.string().required(),
title: yup.string().required(),
description: yup.string(),
type: yup.string().oneOf(['image', 'video']).required(),
url: yup.string().when('type', {
is: val => val === 'image',
then: yup.string().url().required(),
otherwise: yup.string().nullable()
}),
videoUrl: yup.string().when('type', {
is: val => val === 'video',
then: yup.string().url().required(),
otherwise: yup.string().nullable()
})
}))
});

const ScenarioBuilder: React.FC = () => {
const [scenarios, setScenarios] = useState<ScenarioData[]>([]);
const { t } = useTranslation();

useEffect(() => {
// Fetch initial data or set default scenarios here
setScenarios([
{ id: '1', title: 'Scenario 1', type: 'image', url: 'https://example.com/img.jpg' },
{ id: '2', title: 'Scenario 2', type: 'video', videoUrl: 'https://example.com/video.mp4' }
]);
}, []);

const addScenario = () => {
const newId = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
setScenarios([...scenarios, { id: newId, title: '', type: 'image', url: '' }]);
};

const removeScenario = (id: string) => {
setScenarios(scenarios.filter(scenario => scenario.id !== id));
};

return (
<div className={styles.container}>
<h1>{t('creator.title')}</h1>
<Formik
validationSchema={schema}
initialValues={{ scenarios }}
onSubmit={(values, { resetForm }) => {
// Handle form submission here (save, update, etc.)
console.log(JSON.stringify(values));
resetForm();
}}
>
{({ values, errors, touched, handleSubmit }) => (
<form onSubmit={handleSubmit}>
{scenarios.map((scenario) => (
<ScenarioItem
key={scenario.id}
scenario={scenario}
removeScenario={removeScenario}
errors={errors}
touched={touched}
/>
))}
<button type="button" onClick={addScenario}>{t('creator.addScenario')}</button>
<div className={styles.actions}>
<button type="submit">{t('creator.save')}</button>
{/* Other buttons or actions */}
</div>
</form>
)}
</Formik>
</div>
);
};

export default ScenarioBuilder;
