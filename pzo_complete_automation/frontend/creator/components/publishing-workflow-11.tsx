import React from 'react';
import { Formik, FieldArray, Form } from 'formik';
import * as Yup from 'yup';
import { useIntl } from 'react-intl';
import { Box, Button, Grid, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/styles';

const useStyles = makeStyles(() => ({
root: {},
form: {},
contentWrapper: {},
formTitle: {
marginBottom: 24,
},
}));

interface PublishingWorkflow11Props {
handleNextStep: () => void;
handlePrevStep: () => void;
isSubmitting: boolean;
}

const PublishingWorkflow11: React.FC<PublishingWorkflow11Props> = ({
handleNextStep,
handlePrevStep,
isSubmitting,
}) => {
const classes = useStyles();
const intl = useIntl();

const validationSchema = Yup.object().shape({
steps: Yup.array().of(
Yup.object().shape({
title: Yup.string().required(intl.formatMessage({ id: 'common.title_is_required' })),
content: Yup.string().required(intl.formatMessage({ id: 'common.content_is_required' })),
}),
),
});

return (
<Formik
initialValues={{ steps: [{ title: '', content: '' }] }}
validationSchema={validationSchema}
onSubmit={(values, { setSubmitting }) => {
setTimeout(() => {
handleNextStep();
setSubmitting(false);
}, 400);
}}
>
<Form className={classes.form}>
<Box className={classes.contentWrapper}>
<Typography variant="h3" className={classes.formTitle}>
{intl.formatMessage({ id: 'workflow_11.title' })}
</Typography>
<Grid container spacing={3}>
{values.steps &&
values.steps.map((step, index) => (
<Grid item xs={12} sm={6} key={index}>
<FieldArray name={`steps`}>
{(fieldArrayHelpers) => (
<>
<Typography variant="h4">{intl.formatMessage({ id: 'workflow_11.step' }) + (index + 1)}</Typography>
<Box marginTop={2}>
<Field name={`steps[${index}].title`} type="text" as={TextInput} />
</Box>
<Box marginTop={2}>
<Field name={`steps[${index}].content`} type="textarea" as={TextAreaInput} rows={4} />
</Box>
</>
)}
</FieldArray>
</Grid>
))}
</Grid>
</Box>
<Button
color="primary"
variant="contained"
disabled={isSubmitting}
type="submit"
className={classes.root}>
{intl.formatMessage({ id: 'common.next' })}
</Button>
<Box marginTop={2}>
<Button color="primary" variant="outlined" onClick={handlePrevStep} disabled={values.steps.length === 1}>
{intl.formatMessage({ id: 'common.previous' })}
</Button>
</Box>
</Form>
</Formik>
);
};

export default PublishingWorkflow11;
