import * as React from 'react';
import { Container, Row, Col } from 'reactstrap';
import Step1 from './Step1';
import Step2 from './Step2';
import Step3 from './Step3';
import Step4 from './Step4';
import Step5 from './Step5';
import Step6 from './Step6';
import Step7 from './Step7';

interface Props {
onPublish: () => void;
}

const PublishingWorkflow7: React.FC<Props> = ({ onPublish }) => (
<Container fluid>
<Row>
<Col md={6}>
<Step1 />
</Col>
<Col md={6}>
<Step2 />
</Col>
</Row>
<Row>
<Col md={6}>
<Step3 />
</Col>
<Col md={6}>
<Step4 />
</Col>
</Row>
<Row>
<Col md={6}>
<Step5 />
</Col>
<Col md={6}>
<Step6 />
</Col>
</Row>
<Row>
<Col>
<Step7 onPublish={onPublish} />
</Col>
</Row>
</Container>
);

export default PublishingWorkflow7;
