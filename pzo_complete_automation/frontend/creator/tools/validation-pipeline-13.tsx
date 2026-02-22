import React from 'react';
import { Formik, Field, Form } from 'formik';
import * as Yup from 'yup';
import { TextField, Checkbox, Select, DatePicker } from './FormControls';

const validationSchema = Yup.object().shape({
firstName: Yup.string()
.min(2, 'Too Short')
.max(50, 'Too Long')
.required('Required'),
lastName: Yup.string()
.min(2, 'Too Short')
.max(50, 'Too Long')
.required('Required'),
email: Yup.string()
.email('Invalid email')
.required('Required'),
termsAndConditions: Yup.boolean().oneOf([true], 'You must accept terms and conditions.'),
});

const initialValues = {
firstName: '',
lastName: '',
email: '',
termsAndConditions: false,
};

export const ValidationPipeline13: React.FC = () => (
<Formik
validationSchema={validationSchema}
initialValues={initialValues}
onSubmit={(values) => {
console.log(JSON.stringify(values, null, 2));
}}
>
<Form>
<Field name="firstName" component={TextField} label="First Name" />
<Field name="lastName" component={TextField} label="Last Name" />
<Field name="email" component={TextField} type="email" label="Email" />
<Field name="termsAndConditions" component={Checkbox} label="Terms and Conditions" />
<Field name="birthday" component={DatePicker} label="Birthday" />
<button type="submit">Submit</button>
</Form>
</Formik>
);
