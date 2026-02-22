import * as React from 'react';
import { Form, Formik } from 'formik';
import { Field, FormFieldProps } from 'formik';
import { TextField } from 'formik-material-ui';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';

interface BootRun11Values {
firstName: string;
lastName: string;
email: string;
}

const initialValues: BootRun11Values = {
firstName: '',
lastName: '',
email: '',
};

const validationSchema = (values: BootRun11Values) => {
const errors: Partial<BootRun11Values> = {};

if (!values.firstName) {
errors.firstName = 'First name is required';
}

if (!values.lastName) {
errors.lastName = 'Last name is required';
}

if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(values.email)) {
errors.email = 'Invalid email address';
}

return errors;
};

const BootRun11: React.FC = () => {
return (
<div>
<Typography variant="h5" component="h2">
Onboarding + Training - Boot Run 11
</Typography>
<Formik<BootRun11Values>
initialValues={initialValues}
validationSchema={validationSchema}
>
{({ errors, touched }) => (
<Form noValidate autoComplete="off">
<Grid container spacing={3}>
<Grid item xs={12}>
<Field name="firstName" component={TextField} label="First Name" error={errors.firstName && touched.firstName} />
</Grid>
<Grid item xs={12}>
<Field name="lastName" component={TextField} label="Last Name" error={errors.lastName && touched.lastName} />
</Grid>
<Grid item xs={12}>
<Field name="email" component={TextField} type="email" label="Email Address" error={errors.email && touched.email} />
</Grid>
<Grid item xs={12}>
<Button variant="contained" color="primary" type="submit">
Submit
</Button>
</Grid>
</Grid>
</Form>
)}
</Formik>
</div>
);
};

export default BootRun11;
