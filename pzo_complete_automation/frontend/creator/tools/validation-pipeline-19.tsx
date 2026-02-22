import React, { useState } from 'react';
import { ValidationPipelineStep, useValidationPipeline } from '@adobe/aem-spa-validation-pipeline';
import FormComponent from './FormComponent';

const validationSteps: ValidationPipelineStep[] = [
{
id: 'email',
validator: (value) => /\S+@\S+\.\S+/.test(value),
errorMessage: 'Please enter a valid email address.',
},
{
id: 'password',
validator: (value) => value.length >= 8,
errorMessage: 'Password must be at least 8 characters long.',
},
];

const Form = () => {
const [formState, setFormState] = useState({ email: '', password: '' });
const { valid, errors } = useValidationPipeline(validationSteps, formState);

const handleSubmit = (event) => {
event.preventDefault();
// Handle form submission here
};

const handleChange = (event) => {
setFormState({
...formState,
[event.target.name]: event.target.value,
});
};

return (
<form onSubmit={handleSubmit}>
<FormComponent name="email" label="Email" value={formState.email} onChange={handleChange} error={errors['email']} />
<FormComponent name="password" type="password" label="Password" value={formState.password} onChange={handleChange} error={errors['password']} />
<button type="submit" disabled={!valid}>Submit</button>
</form>
);
};

export default Form;
