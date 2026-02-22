import React, { useState } from 'react';
import { Box, Button, Heading, Text } from '@chakra-ui/core';
import CodeEditor from './CodeEditor';
import ChallengeCard from './ChallengeCard';
import ExplanationModal from './ExplanationModal';
import useOnboardingStore from '../../stores/useOnboardingStore';
import { PracticeSandbox8Data } from '../../data/onboarding-data';

const PracticeSandbox8 = () => {
const [isExplanationOpen, setIsExplanationOpen] = useState(false);
const [selectedCode, setSelectedCode] = useState('');
const onboardingStore = useOnboardingStore();

const handleCodeSelect = (code: string) => {
setSelectedCode(code);
setIsExplanationOpen(true);
};

const handleCodeSubmit = (code: string) => {
// TODO: Implement code submission logic here
if (code === PracticeSandbox8Data.solution) {
onboardingStore.incrementCompletedStep();
}
};

return (
<ChallengeCard>
<Box>
<Heading size="xl" mb={4}>
Practice Sandbox 8
</Heading>
<Text fontSize="lg" mb={6}>
Write a function that takes an array of objects as input, and returns the average age of all people in the array.
</Text>
</Box>
<CodeEditor onCodeSelect={handleCodeSelect} onCodeSubmit={handleCodeSubmit} />
<ExplanationModal isOpen={isExplanationOpen} onClose={() => setIsExplanationOpen(false)}>
{PracticeSandbox8Data.explanation}
</ExplanationModal>
</ChallengeCard>
);
};

export default PracticeSandbox8;
