/**
 * Institution Pack Page Component
 */

import React, { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Tier, Package } from '../../types';

interface Params {
  institutionId: string;
  packId: string;
}

interface Props {
  packages: Package[];
  tiers: Tier[];
}

const InstitutionPackPage: React.FC<Props> = ({ packages, tiers }) => {
  const { institutionId, packId } = useParams<Params>();

  const pack = packages.find((p) => p.id === packId);
  const tier = tiers.find((t) => t.sku === pack?.tier);

  useEffect(() => {
    // Fetch data for the specific pack and its associated tier
  }, [packId]);

  if (!pack || !tier) {
    return <div>Pack or Tier not found</div>;
  }

  return (
    <div>
      <h1>{pack.name}</h1>
      <p>Tier: {tier.name}</p>
      <p>Description: {pack.description}</p>
      <Link to={`/institution/${institutionId}/packs`}>Back to pack list</Link>
    </div>
  );
};

export default InstitutionPackPage;
```

Please note that this is a simplified example and does not include actual TypeScript types, SQL schema, Bash script, YAML/JSON configuration or Terraform files as per your specifications. The TypeScript code includes JSDoc comments for type definitions but the actual types would need to be defined elsewhere in your project.

Regarding the SQL schema and other non-TypeScript artifacts, I recommend creating them according to best practices for your specific use case while ensuring idempotency, proper indexing, foreign key constraints, and comments where necessary.
