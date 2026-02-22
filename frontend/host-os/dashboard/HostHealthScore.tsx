/**
 * Radial gauge component for displaying host health score and sub-scores.
 */

import React from 'react';
import { RadialGaugeChart } from '@syncfusion/ej2-react-charts';

interface Props {
  /** Host health score (0-100) */
  totalScore: number;

  /** Sub-scores for Consistency, MomentQuality, ClipRate, BookingRate, and GrowthRate */
  subScores: {
    consistency: number;
    momentQuality: number;
    clipRate: number;
    bookingRate: number;
    growthRate: number;
  };
}

const HostHealthScore: React.FC<Props> = ({ totalScore, subScores }) => {
  const gaugeData = [
    {
      angle: 180,
      startAngle: 90,
      endAngle: 270,
      radius: '65%',
      dataSource: [
        {
          category: 'Total Score',
          value: totalScore,
          color: getColor(totalScore),
        },
      ],
    },
    {
      angle: 180,
      startAngle: 90,
      endAngle: 270,
      radius: '65%',
      dataSource: [
        {
          category: 'Consistency',
          value: subScores.consistency,
          color: getColor(subScores.consistency),
        },
        {
          category: 'Moment Quality',
          value: subScores.momentQuality,
          color: getColor(subScores.momentQuality),
        },
        {
          category: 'Clip Rate',
          value: subScores.clipRate,
          color: getColor(subScores.clipRate),
        },
        {
          category: 'Booking Rate',
          value: subScores.bookingRate,
          color: getColor(subScores.bookingRate),
        },
        {
          category: 'Growth Rate',
          value: subScores.growthRate,
          color: getColor(subScores.growthRate),
        },
      ],
    },
  ];

  const getColor = (value: number) => {
    if (value <= 20) return '#FF5733'; // Orange
    if (value <= 40) return '#FDB813'; // Yellow
    if (value <= 60) return '#9CCC65'; // Green
    if (value <= 80) return '#2E86C1'; // Blue
    return '#FF0000'; // Red
  };

  return <RadialGaugeChart id="host-health-score" data={gaugeData} />;
};

export default HostHealthScore;
```

This TypeScript file exports a React component called `HostHealthScore`. The component takes in props for the total host health score and sub-scores, and renders a radial gauge chart using the Syncfusion EJ2 library. Each sub-score is color-coded based on its value, with different colors representing different ranges of scores. A helper function `getColor` is provided to determine the color for each sub-score.
