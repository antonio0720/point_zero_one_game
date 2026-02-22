import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

interface Props {
title: string;
onPress: () => void;
}

const iOSButton: React.FC<Props> = ({ title, onPress }) => (
<TouchableOpacity onPress={onPress} style={{
backgroundColor: '#4CD964',
paddingVertical: 10,
paddingHorizontal: 20,
borderRadius: 5,
alignItems: 'center'
}}>
<Text style={{ color: '#fff', fontSize: 18 }}>{title}</Text>
</TouchableOpacity>
);

export default iOSButton;
