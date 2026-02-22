import * as React from 'react';
import { useState } from 'react';
import { Button, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

const BootRunOne = () => {
const [isStarted, setIsStarted] = useState(false);
const { t } = useTranslation();

const handleStartButtonPress = () => {
setIsStarted(true);
};

return (
<View>
{!isStarted && (
<>
<Text>{t('welcomeMessage')}</Text>
<Button title={t('startButton')} onPress={handleStartButtonPress} />
</>
)}
{isStarted && (
<>
<Text>{t('trainingInstructions')}</Text>
<Button title={t('nextStep')} />
</>
)}
</View>
);
};

export default BootRunOne;
