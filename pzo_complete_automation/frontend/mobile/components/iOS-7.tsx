import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const iOS7Button = ({ label, onPress, iconName, imageSource, style }) => (
<TouchableOpacity onPress={onPress} style={[styles.button, style]}>
{iconName && <Ionicons name={iconName} size={24} color="#fff" />}
{imageSource && <Image source={imageSource} style={styles.image} />}
<Text style={styles.label}>{label}</Text>
</TouchableOpacity>
);

const styles = Theme.create({
button: {
backgroundColor: '#34495e',
paddingVertical: 10,
paddingHorizontal: 20,
borderRadius: 3,
justifyContent: 'center',
alignItems: 'center',
flexDirection: 'row',
},
label: {
fontSize: 16,
color: '#fff',
marginLeft: 10,
},
image: {
width: 24,
height: 24,
position: 'absolute',
top: -6,
left: -6,
},
});

export default iOS7Button;
