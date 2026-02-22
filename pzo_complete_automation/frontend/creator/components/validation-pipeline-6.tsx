import React from 'react';
import { Formik, FieldArray, Form } from 'formik';
import * as Yup from 'yup';

const ValidationPipeline6 = () => {
const validationSchema = Yup.object().shape({
items: Yup.array().of(
Yup.object().shape({
name: Yup.string().required('Required'),
value: Yup.number()
.positive()
.integer()
.required('Required'),
}),
),
});

const handleSubmit = (values, { resetForm }) => {
// Handle form submission logic here
console.log(JSON.stringify(values, null, 2));
resetForm();
};

return (
<div>
<h1>Validation Pipeline 6</h1>
<Formik
initialValues={{ items: [{ name: '', value: null }] }}
validationSchema={validationSchema}
onSubmit={handleSubmit}
>
{({ values, isValid }) => (
<Form>
<FieldArray name="items">
{({ push }) => (
<>
{values.items.map((item, index) => (
<div key={index}>
<label htmlFor={`name${index}`}>Name</label>
<input type="text" id={`name${index}`} name={`items[${index}].name`} />
<br />
<label htmlFor={`value${index}`}>Value</label>
<input type="number" id={`value${index}`} name={`items[${index}].value`} />
<br />
</div>
))}
<button type="button" onClick={() => push({ name: '', value: null })}>
Add more validation items
</button>
</>
)}
</FieldArray>
<button type="submit" disabled={!isValid}>
Submit
</button>
</Form>
)}
</Formik>
</div>
);
};

export default ValidationPipeline6;
