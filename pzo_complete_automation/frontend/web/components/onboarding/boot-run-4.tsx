import * as React from 'react';
import { Form, Input, Button } from 'antd';
import { useIntl } from 'react-intl';

interface BootRun4FormValues {
apiKey: string;
}

const BootRun4: React.FC = () => {
const intl = useIntl();

const [form] = Form.useForm<BootRun4FormValues>();

const handleSubmit = (values: BootRun4FormValues) => {
// Handle form submission, e.g., send the API key to your backend service
console.log('Success:', values);
};

return (
<Form form={form} onFinish={handleSubmit}>
<Form.Item
name="apiKey"
label={intl.formatMessage({ id: 'app.onboarding.apiKey' })}
rules={[{ required: true, message: intl.formatMessage({ id: 'app.onboarding.apiKeyRequired' }) }]}
>
<Input />
</Form.Item>

<Form.Item>
<Button type="primary" htmlType="submit">
{intl.formatMessage({ id: 'app.onboarding.next' })}
</Button>
</Form.Item>
</Form>
);
};

export default BootRun4;
