import React from 'react';
import { Formik, Field, Form } from 'formik';
import * as Yup from 'yup';
import { Container, Row, Col, Button } from 'reactstrap';
import { useTranslation } from 'react-i18next';
import { FaCheckCircle, FaTimesCircle } from 'react-icons/fa';

const validationSchema = Yup.object().shape({
password: Yup.string()
.min(8, 'Minimum 8 characters')
.matches(/[a-zA-Z]+/, 'Must contain at least one letter')
.matches(/[0-9]+/, 'Must contain at least one number')
.required('Required'),
});

const BootRun6 = () => {
const { t } = useTranslation();

return (
<Container className="pt-5">
<Row>
<Col md={{ size: 8, offset: 2 }}>
<h1 className="text-center">{t('onboarding.title6')}</h1>
<p className="lead text-center">{t('onboarding.subtitle6')}</p>
</Col>
</Row>
<Row className="mt-5 justify-content-center">
<Col md={8}>
<Formik
initialValues={{ password: '' }}
validationSchema={validationSchema}
onSubmit={() => {}}
>
{({ errors, touched }) => (
<Form>
<Field name="password" type="password" className="form-control mb-3" />
{errors.password && touched.password ? (
<div className="text-danger">{errors.password}</div>
) : null}
<Button color="primary" block type="submit" className="mt-4">
{t('onboarding.button6')}
</Button>
</Form>
)}
</Formik>
</Col>
</Row>
<Row className="text-center mt-5">
<Col md={4}>
<div className="d-flex align-items-center justify-content-center">
<FaCheckCircle size={32} />
<div>
<h6>{t('onboarding.checklist6.1')}</h6>
<p>{t('onboarding.checklistDescription6.1')}</p>
</div>
</div>
</Col>
<Col md={4}>
<div className="d-flex align-items-center justify-content-center">
<FaTimesCircle size={32} color="#dc3545" />
<div>
<h6>{t('onboarding.checklist6.2')}</h6>
<p>{t('onboarding.checklistDescription6.2')}</p>
</div>
</div>
</Col>
</Row>
</Container>
);
};

export default BootRun6;
