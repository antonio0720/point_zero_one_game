/**
 * CardScanScreen component for Point Zero One Digital's mobile app.
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Camera, QRCodeScanner } from 'react-native';
import Haptics from 'expo-haptics';

/**
 * Props for CardScanScreen component.
 */
interface Props {
  onScanSuccess: (data: string) => void;
}

/**
 * Styles for CardScanScreen component.
 */
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  cameraView: {
    flex: 1,
  },
  scanResultContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingVertical: 30,
  },
  scanResultText: {
    fontSize: 18,
    textAlign: 'center',
  },
});

/**
 * CardScanScreen component.
 */
const CardScanScreen: React.FC<Props> = ({ onScanSuccess }) => {
  const cameraRef = React.useRef(null);
  const scanResultAnimatedValue = new Animated.Value(0);

  useEffect(() => {
    const subscribe = Camera.getCameraPermissionsAsync().then(({ granted }) => {
      if (granted) {
        cameraRef.current = new QRCodeScanner({ flashMode: Camera.Constants.FlashMode.on });
        cameraRef.current.showCameraErrorsDialogBox = false;
        cameraRef.current.onScanCompleted = data => {
          onScanSuccess(data);
          Animated.timing(scanResultAnimatedValue, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }).start();
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        };
      }
    });

    return subscribe;
  }, [onScanSuccess]);

  const scanResultStyles = {
    opacity: scanResultAnimatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
    }),
  };

  return (
    <View style={styles.container}>
      <Camera ref={cameraRef} style={styles.cameraView} type={Camera.Constants.Type.back} />
      <View style={[styles.scanResultContainer, scanResultStyles]}>
        <QRCodeScanner.Overlay
          containerStyle={{ flex: 1 }}
          cameraStyle={{ padding: 20 }}
          topContent={<Text style={styles.scanResultText}>Please scan the QR code</Text>}
          bottomContent={
            <Animated.View style={[styles.scanResultContainer, { transform: [{ scaleY: scanResultAnimatedValue }] }]}>
              <Text style={[styles.scanResultText, { textAlign: 'center' }]}>Scanning...</Text>
            </Animated.View>
          }
        />
      </View>
      <TouchableOpacity style={{ position: 'absolute', bottom: 20, left: 20, right: 20 }} onPress={() => {}}>
        <Text style={styles.scanResultText}>Run simulator</Text>
      </TouchableOpacity>
    </View>
  );
};

export default CardScanScreen;
