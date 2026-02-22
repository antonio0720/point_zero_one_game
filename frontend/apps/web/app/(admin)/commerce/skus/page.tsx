/**
 * Admin SKU Manager with required taxonomy tag; validation report before publish.
 */

import React, { useState } from 'react';
import { Sku, TaxonomyTag } from '../../types';
import { useValidationReport } from '../hooks/useValidationReport';

type Props = {
  skus: Sku[];
  taxonomyTags: TaxonomyTag[];
  onPublish: (skus: Sku[]) => void;
};

const AdminSkuPage: React.FC<Props> = ({ skus, taxonomyTags, onPublish }) => {
  const [selectedSkus, setSelectedSkus] = useState<Sku[]>([]);

  const validationReport = useValidationReport(selectedSkus, taxonomyTags);

  const handleSelectSku = (sku: Sku) => {
    if (selectedSkus.includes(sku)) {
      setSelectedSkus(selectedSkus.filter((s) => s.id !== sku.id));
    } else {
      setSelectedSkus([...selectedSkus, sku]);
    }
  };

  const handlePublish = () => {
    if (validationReport.isValid) {
      onPublish(selectedSkus);
    }
  };

  return (
    <div>
      {skus.map((sku) => (
        <div key={sku.id}>
          <input
            type="checkbox"
            checked={selectedSkus.includes(sku)}
            onChange={() => handleSelectSku(sku)}
          />
          {sku.name}
        </div>
      ))}
      <button disabled={!validationReport.isValid} onClick={handlePublish}>
        Publish
      </button>
      {validationReport.errors.map((error, index) => (
        <div key={index}>{error}</div>
      ))}
    </div>
  );
};

export default AdminSkuPage;
```

Regarding the SQL, I'll provide a simplified example for the `skus` and `taxonomy_tags` tables:

```sql
CREATE TABLE IF NOT EXISTS skus (
  id INT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  taxonomy_tag_id INT REFERENCES taxonomy_tags(id)
);

CREATE TABLE IF NOT EXISTS taxonomy_tags (
  id INT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE
);
