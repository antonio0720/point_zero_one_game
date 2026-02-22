import React from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

const Android4 = () => {
const { t } = useTranslation();

return (
<View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
<Text>{t('android_screen_4')}</Text>
</View>
);
};

export default Android4;
