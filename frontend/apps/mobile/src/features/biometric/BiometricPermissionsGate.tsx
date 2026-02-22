/**
 * BiometricPermissionsGate component for mobile app
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

/**
 * Props interface for BiometricPermissionsGate component
 */
interface BiometricPermissionsGateProps {
  onBiometricConsent: (consent: boolean) => void;
}

/**
 * BiometricPermissionsGate component
 * Displays a consent prompt for biometric authentication and stores the consent status server-side.
 */
const BiometricPermissionsGate: React.FC<BiometricPermissionsGateProps> = ({ onBiometricConsent }) => {
  const [consent, setConsent] = useState(false);

  const handleConsentChange = (newConsent: boolean) => {
    setConsent(newConsent);
    onBiometricConsent(newConsent);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Biometric Consent</Text>
      <Text style={styles.description}>
        By enabling biometric authentication, you agree to allow our app to use your device's biometric data for authentication purposes only. You can opt-out at any time. Your consent will be stored server-side and no biometric data will be transmitted without active consent.
      </Text>
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={[styles.button, !consent && styles.disabledButton]} onPress={() => handleConsentChange(true)}>
          <Text style={styles.buttonText}>Enable Biometric Authentication</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, consent && styles.disabledButton]} onPress={() => handleConsentChange(false)}>
          <Text style={styles.buttonText}>Disable Biometric Authentication</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  button: {
    backgroundColor: '#4CAF50',
    borderRadius: 5,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
  },
});

export default BiometricPermissionsGate;
