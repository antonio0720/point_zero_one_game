import React from 'react';
import { Formik, Field, Form } from 'formik';
import * as Yup from 'yup';
import { TextField } from '@material-ui/core';

const validationSchema = Yup.object().shape({
name: Yup.string().required('Name is required'),
email: Yup.string().email('Invalid email address').required('Email is required'),
});

interface Values {
name: string;
email: string;
}

export const ValidationPipeline18: React.FC = () => (
<Formik
initialValues={{ name: '', email: '' }}
validationSchema={validationSchema}
onSubmit={(values, { setSubmitting }) => {
setTimeout(() => {
alert(JSON.stringify(values, null, 2));
setSubmitting(false);
}, 400);
}}
>
<Form>
<Field name="name" component={TextField} label="Name" />
<Field name="email" component={TextField} type="email" label="Email Address" />
<button type="submit" disabled={!this.props.isSubmitting}>Submit</button>
</Form>
</Formik>
);
