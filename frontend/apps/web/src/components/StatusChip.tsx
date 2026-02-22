/**
 * StatusChip component for displaying status information in various parts of the application.
 */

import React from 'react';
import { Text, View } from 'react-native';

type Props = {
  /** The status text to be displayed. */
  status: string;

  /** The color of the chip. */
  color?: string;
};

/**
 * A reusable status chip component.
 * @param props - The properties of the StatusChip component.
 */
const StatusChip: React.FC<Props> = ({ status, color }) => {
  return (
    <View style={{ backgroundColor: color, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 }}>
      <Text style={{ fontSize: 12, lineHeight: 16, textAlign: 'center'}}>{status}</Text>
    </View>
  );
};

export { StatusChip };
