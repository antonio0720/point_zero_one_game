import React from 'react';
import { useTranslation } from 'react-i18next';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { Button, TextField } from '@patternfly/react-core';

interface ValidationPipelineFormValues {
name: string;
description?: string;
}

const validationSchema = Yup.object().shape({
name: Yup.string()
.min(3, 'Name must be at least 3 characters')
.max(255, 'Name cannot exceed 255 characters')
.required('Name is required'),
});

const ValidationPipelineForm: React.FC = () => {
const { t } = useTranslation();

return (
<Formik<ValidationPipelineFormValues>
initialValues={{ name: '', description: '' }}
validationSchema={validationSchema}
onSubmit={(values) => {
// Handle form submission here
}}
>
{({ isSubmitting }) => (
<Form>
<Field name="name">
{({ field, form }) => (
<TextField
{...field}
aria-label={t('Name')}
error={form.errors.name && form.touched.name}
helperTextInvalid={form.errors.name}
isRequired
label={t('Name')}
/>
)}
</Field>
<ErrorMessage name="name" component="div" />

<Field name="description">
{({ field, form }) => (
<TextField
{...field}
aria-label={t('Description')}
error={form.errors.description && form.touched.description}
helperTextInvalid={form.errors.description}
isRequired={false}
label={t('Description')}
/>
)}
</Field>
<ErrorMessage name="description" component="div" />

<Button type="submit" isDisabled={isSubmitting}>
{t('Save')}
</Button>
</Form>
)}
</Formik>
);
};

export default ValidationPipelineForm;
