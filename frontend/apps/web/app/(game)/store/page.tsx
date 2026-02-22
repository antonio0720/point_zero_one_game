/**
 * Store page that renders SKU class labels and 'Does not affect outcomes' line per SKU; link to pointzeroonegame.com/integrity.
 */

import React from 'react';

type Sku = {
  id: number;
  label: string;
  affectsOutcome: boolean;
};

interface Props {
  skus: Sku[];
}

const Page: React.FC<Props> = ({ skus }) => (
  <div>
    {skus.map((sku) => (
      <div key={sku.id}>
        <strong>{sku.label}</strong>
        {!sku.affectsOutcome ? (
          <span className="nonAffecting"> Does not affect outcomes </span>
        ) : null}
      </div>
    ))}
    <a href="https://pointzeroonegame.com/integrity" target="_blank" rel="noopener noreferrer">
      Learn more about our commitment to integrity
    </a>
  </div>
);

export default Page;
