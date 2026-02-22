import React, { FC, useState } from 'react';
import { Formik, Field, Form, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { TextField, Button } from '@material-ui/core';

interface Props {}

const schema = Yup.object().shape({
name: Yup.string().required('Name is required'),
});

const InitialValues = {
name: '',
};

const ValidationPipeline16: FC<Props> = () => {
const [isSubmitting, setIsSubmitting] = useState(false);

const handleSubmit = async (values) => {
setIsSubmitting(true);

// Handle form submission logic here.
console.log(JSON.stringify(values));

setIsSubmitting(false);
};

return (
<Formik
initialValues={InitialValues}
validationSchema={schema}
onSubmit={handleSubmit}
>
{({ errors, touched }) => (
<Form>
<Field name="name" type="text" as={TextField} fullWidth label="Name" />
<ErrorMessage name="name" component="div" />
<Button type="submit" disabled={isSubmitting}>
Submit
</Button>
</Form>
)}
</Formik>
);
};

export default ValidationPipeline16;
