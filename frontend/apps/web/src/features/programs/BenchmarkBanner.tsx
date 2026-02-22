/**
 * BenchmarkBanner component for Point Zero One Digital's financial roguelike game.
 */

import React from 'react';

type Props = {
  /**
   * A callback to start a new benchmark run.
   */
  onBenchmarkStart: () => void;
};

/**
 * BenchmarkBanner component explains that it is for measurement and has a zero classroom tone.
 *
 * @param props - Props object containing the `onBenchmarkStart` callback.
 */
const BenchmarkBanner: React.FC<Props> = ({ onBenchmarkStart }) => (
  <div className="benchmark-banner">
    <h2>Benchmark run</h2>
    <p>This is a measurement tool to help you understand the performance of your strategies.</p>
    <button onClick={onBenchmarkStart}>Start benchmark</button>
  </div>
);

export { BenchmarkBanner, Props };
