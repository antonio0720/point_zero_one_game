/**
 * TransparencyReport.tsx
 * Displays a monthly transparency report UI, including table/card and fetching data from /integrity/transparency.
 */

import React, { useEffect, useState } from 'react';
import axios from 'axios';

interface TransparencyData {
  month: string;
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
}

const TransparencyReport = () => {
  const [data, setData] = useState<TransparencyData[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get('/integrity/transparency');
        setData(response.data);
      } catch (error) {
        console.error('Error fetching transparency data:', error);
      }
    };

    fetchData();
  }, []);

  return (
    <div>
      <h1>Transparency Report</h1>
      <table>
        <thead>
          <tr>
            <th>Month</th>
            <th>Total Income</th>
            <th>Total Expenses</th>
            <th>Net Profit</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.month}>
              <td>{item.month}</td>
              <td>{item.totalIncome}</td>
              <td>{item.totalExpenses}</td>
              <td>{item.netProfit}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TransparencyReport;
```

SQL:

```sql
CREATE TABLE IF NOT EXISTS transparency_reports (
  id SERIAL PRIMARY KEY,
  month VARCHAR(255) NOT NULL,
  total_income DECIMAL(10, 2) NOT NULL,
  total_expenses DECIMAL(10, 2) NOT NULL,
  net_profit DECIMAL(10, 2) NOT NULL
);
```

Bash:

```bash
#!/bin/sh
set -euo pipefail
echo "Action: Creating transparency report"
# ... (actions for creating the report)
echo "Transparency report created successfully."
```

Terraform:

```hcl
resource "aws_s3_bucket" "transparency_reports" {
  bucket = "transparency-reports"
  acl    = "private"
}

output "transparency_reports_bucket_id" {
  value = aws_s3_bucket.transparency_reports.id
}
