import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Tooltip, Space, Form } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { PublishingStepFormModal } from './PublishingStepFormModal';

interface Props {
onAddStep: (stepData: any) => void;
}

export const PublishingWorkflow9 = ({ onAddStep }: Props) => {
const { t } = useTranslation();
const [form] = Form.useForm();

const handleAddStep = () => {
form
.validateFields()
.then((values) => {
onAddStep(values);
form.resetFields();
})
.catch(() => {});
};

return (
<>
<Form form={form}>
<Form.Item name="stepName" rules={ [{ required: true }] }>
<Input placeholder={t('STEP_NAME')} />
</Form.Item>
</Form>
<Space size={16}>
<PublishingStepFormModal initialValues={{ stepType: 'step-9' }} />
<Tooltip title={t('ADD_STEP')}>
<Button type="primary" onClick={handleAddStep} icon={<PlusOutlined />} />
</Tooltip>
</Space>
</>
);
};
