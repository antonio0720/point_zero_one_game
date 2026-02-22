import * as React from 'react';
import { useFormik } from 'formik';
import { Dialog, DialogActions, DialogContent, DialogTitle, Button, TextField, Typography } from '@material-ui/core';
import * as Yup from 'yup';

interface ParentalConsentValues {
name: string;
email: string;
}

const initialValues: ParentalConsentValues = {
name: '',
email: '',
};

const validationSchema = Yup.object().shape({
name: Yup.string()
.min(3, 'Name must be at least 3 characters')
.required('Name is required'),
email: Yup.string().email('Invalid email address').required('Email is required'),
});

const ParentalConsentModal: React.FC = () => {
const [open, setOpen] = React.useState(false);

const handleClickOpen = () => {
setOpen(true);
};

const formik = useFormik<ParentalConsentValues>({
initialValues,
validationSchema,
onSubmit: (values) => {
// Handle form submission
},
});

return (
<div>
<Button onClick={handleClickOpen}>Open Parental Consent Modal</Button>
<Dialog open={open} onClose={() => setOpen(false)} aria-labelledby="parental-consent-modal">
<DialogTitle id="parental-consent-modal">Parental Consent Form</DialogTitle>
<DialogContent>
<Typography variant="h6" component="h2" gutterBottom>
Welcome! Please complete the form below to consent to your child's use of our service.
</Typography>
<form onSubmit={formik.handleSubmit}>
<TextField
fullWidth
margin="normal"
label="Name"
name="name"
value={formik.values.name}
onChange={formik.handleChange}
error={formik.touched.name && Boolean(formik.errors.name)}
helperText={formik.touched.name && formik.errors.name}
/>
<TextField
fullWidth
margin="normal"
label="Email"
name="email"
value={formik.values.email}
onChange={formik.handleChange}
error={formik.touched.email && Boolean(formik.errors.email)}
helperText={formik.touched.email && formik.errors.email}
/>
<DialogActions>
<Button onClick={() => setOpen(false)} color="primary">
Cancel
</Button>
<Button type="submit" disabled={!formik.isValid}>
Submit
</Button>
</DialogActions>
</form>
</DialogContent>
</Dialog>
</div>
);
};

export default ParentalConsentModal;
