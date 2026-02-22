import React from 'react';

interface ValidationStepProps {
id: string;
title: string;
description: string;
validationFn: (values: any) => boolean | Promise<boolean>;
}

interface ValidationPipelineProps {
steps: Array<ValidationStepProps>;
initialValues: object;
onValidateSuccess: () => void;
}

const validationPipeline = ({ steps, initialValues, onValidateSuccess }: ValidationPipelineProps) => {
const [currentStepIndex, setCurrentStepIndex] = React.useState(0);
const [formValues, setFormValues] = React.useState(initialValues);

const validateStep = async (stepId: string) => {
const step = steps.find((s) => s.id === stepId);
if (!step) return;

const isValid = await step.validationFn(formValues);

if (isValid) {
setCurrentStepIndex((prev) => prev + 1);
if (currentStepIndex < steps.length - 1) return;
onValidateSuccess();
}
};

const handleInputChange = (event: React.FormEvent<HTMLInputElement>) => {
setFormValues({ ...formValues, [event.currentTarget.name]: event.currentTarget.value });
};

return (
<div>
{steps[currentStepIndex].title} - {steps[currentStepIndex].description}
{/* Render the form fields for the current step */}
<form>
{Object.entries(steps[currentStepIndex].id === currentStepIndex ? steps[currentStepIndex].fields : {}).map(
([fieldId, fieldConfig]) => (
<div key={fieldId}>
<label htmlFor={fieldId}>{fieldConfig.label}</label>
<input type={fieldConfig.type} id={fieldId} name={fieldId} onChange={handleInputChange} />
</div>
)
)}
</form>
{currentStepIndex < steps.length - 1 && (
<button onClick={() => validateStep(steps[currentStepIndex + 1].id)}>Next</button>
)}
</div>
);
};

export default validationPipeline;
