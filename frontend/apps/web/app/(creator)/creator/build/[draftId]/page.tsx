/**
 * CreatorPage component for Builder screen (ruleset modules, deck weights, macro regime) with real-time validation.
 */

type RulesetModule = {
  id: number;
  name: string;
  cards: number[];
};

type DeckWeight = {
  id: number;
  name: string;
  weight: number;
};

type MacroRegime = {
  id: number;
  name: string;
  rulesetModuleId: number;
  deckWeightIds: number[];
};

type CreatorPageProps = {
  draftId: number;
};

const CreatorPage: React.FC<CreatorPageProps> = ({ draftId }) => {
  // Implement component logic here with real-time validation and state management

  return (
    <div>
      {/* Render ruleset modules, deck weights, macro regime */}
    </div>
  );
};

export default CreatorPage;
```

SQL:

```sql
CREATE TABLE IF NOT EXISTS ruleset_modules (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS deck_weights (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  weight INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS macro_regimes (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  ruleset_module_id INTEGER REFERENCES ruleset_modules(id),
  deck_weight_id INT[]
);
```

Bash:

```bash
#!/bin/sh
set -euo pipefail
echo "Running action"
# Perform actions here
echo "Action completed"
```

Terraform (example for a simple resource):

```hcl
resource "aws_s3_bucket" "example" {
  bucket = "example-bucket"
  acl    = "private"
}
