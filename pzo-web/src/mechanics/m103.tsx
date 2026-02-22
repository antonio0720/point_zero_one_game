import React from 'react';
import { M103State } from './M103State';
import { M103Props } from './M103Props';

export const M103 = (props: M103Props) => {
  return (
    <div className="virality-surface">
      <h2>Emergency Liquidity Actions</h2>
      <p>Sell Fast, Pay the Price</p>
      {ml_enabled && (
        <div>
          <label>
            Sell Threshold:
            <input
              type="range"
              min={0}
              max={100}
              value={props.sellThreshold}
              onChange={(e) => props.setSellThreshold(Number(e.target.value))}
            />
            <span>{props.sellThreshold}%</span>
          </label>
        </div>
      )}
      {ml_enabled && (
        <div>
          <label>
            Pay Threshold:
            <input
              type="range"
              min={0}
              max={100}
              value={props.payThreshold}
              onChange={(e) => props.setPayThreshold(Number(e.target.value))}
            />
            <span>{props.payThreshold}%</span>
          </label>
        </div>
      )}
    </div>
  );
};

export const M103State = {
  sellThreshold: 0,
  payThreshold: 0,
};
