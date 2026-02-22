import React from 'react';
import { Formik, Field, Form, ErrorMessage } from 'formik';
import * as Yup from 'yup';

const validationSchema = Yup.object().shape({
name: Yup.string()
.min(2, 'Name must be at least 2 characters')
.max(50, 'Name cannot exceed 50 characters')
.required('Name is required'),
email: Yup.string()
.email('Invalid email address')
.required('Email is required'),
password: Yup.string()
.min(8, 'Password must be at least 8 characters')
.matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/, 'Password must contain at least one lowercase letter, one uppercase letter, one digit, and one special character')
.required('Password is required'),
confirmPassword: Yup.string().when('password', {
is: val => (val && val.length > 0),
then: Yup.string()
.oneOf([Yup.ref('password'), null], 'Passwords must match')
.required('Confirm password is required'),
}),
});

interface Values {
name: string;
email: string;
password: string;
confirmPassword: string;
}

const InitialValues: Values = {
name: '',
email: '',
password: '',
confirmPassword: '',
};

interface Props {}

const ValidationPipeline8: React.FC<Props> = () => (
<Formik
initialValues={InitialValues}
validationSchema={validationSchema}
onSubmit={(values, { setSubmitting }) => {
setTimeout(() => {
alert(JSON.stringify(values, null, 2));
setSubmitting(false);
}, 400);
}}
>
<Form>
<label htmlFor="name">Name</label>
<Field name="name" type="text" id="name" />
<ErrorMessage name="name" component="div" />

<label htmlFor="email">Email</label>
<Field name="email" type="email" id="email" />
<ErrorMessage name="email" component="div" />

<label htmlFor="password">Password</label>
<Field name="password" type="password" id="password" />
<ErrorMessage name="password" component="div" />

<label htmlFor="confirmPassword">Confirm Password</label>
<Field name="confirmPassword" type="password" id="confirmPassword" />
<ErrorMessage name="confirmPassword" component="div" />

<button type="submit" disabled={!this.props.isValid || this.props.isSubmitting}>Submit</button>
</Form>
</Formik>
);

export default ValidationPipeline8;
