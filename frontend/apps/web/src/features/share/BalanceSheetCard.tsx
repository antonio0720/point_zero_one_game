/**
 * BalanceSheetCard component for Point Zero One Digital's financial roguelike game.
 */

import React from 'react';
import { BalanceSheetData } from '../../types/BalanceSheetData';

type Props = {
  balanceSheetData: BalanceSheetData;
};

const BalanceSheetCard: React.FC<Props> = ({ balanceSheetData }) => {
  return (
    <div className="balance-sheet-card">
      <h2>{balanceSheetData.name}</h2>
      <table>
        <thead>
          <tr>
            <th>Assets</th>
            <th>Liabilities</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{balanceSheetData.totalAssets}</td>
            <td>{balanceSheetData.totalLiabilities}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export { BalanceSheetCard, Props };
```

Regarding the SQL schema for the `BalanceSheetData`, I'll provide a simplified example:

```sql
CREATE TABLE IF NOT EXISTS balance_sheet_data (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  totalAssets NUMERIC(10, 2) NOT NULL,
  totalLiabilities NUMERIC(10, 2) NOT NULL
);

CREATE INDEX IF NOT EXISTS balance_sheet_data_name_idx ON balance_sheet_data (name);
