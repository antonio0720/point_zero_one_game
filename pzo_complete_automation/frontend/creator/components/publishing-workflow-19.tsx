import React from 'react';
import { useIntl } from 'react-intl';
import { Box, Heading, Text, Flex, Button } from '@chakra-ui/core';

interface PublishingWorkflow19Props {
onReviewClick: () => void;
onPublishClick: () => void;
}

const PublishingWorkflow19: React.FC<PublishingWorkflow19Props> = ({
onReviewClick,
onPublishClick,
}) => {
const intl = useIntl();

return (
<Box>
<Heading size="xl" mb={6}>
{intl.formatMessage({ id: 'publishingWorkflow19Title' })}
</Heading>
<Flex justifyContent="space-between" alignItems="center">
<Text>{intl.formatMessage({ id: 'publishingWorkflow19StepOne' })}</Text>
<Button onClick={onReviewClick} variantColor="teal">
{intl.formatMessage({ id: 'review' })}
</Button>
</Flex>
<Flex justifyContent="space-between" alignItems="center" mt={6}>
<Text>{intl.formatMessage({ id: 'publishingWorkflow19StepTwo' })}</Text>
<Button onClick={onPublishClick} variantColor="blue">
{intl.formatMessage({ id: 'publish' })}
</Button>
</Flex>
</Box>
);
};

export default PublishingWorkflow19;
