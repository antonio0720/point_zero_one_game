/**
 * Cohorts Admin Page
 */

import React, { useState } from 'react';
import { useHistory, Link } from 'react-router-dom';
import { Formik, Field, Form, ErrorMessage } from 'formik';
import * as Yup from 'yup';

// Custom hooks and components
import useCohort from '../../hooks/useCohort';
import useRules from '../../hooks/useRules';
import Button from '../Button';
import TextInput from '../TextInput';

interface Cohort {
  id: number;
  name: string;
  rules: Rule[];
}

interface Rule {
  id: number;
  condition: string;
  reward: string;
}

const validationSchema = Yup.object().shape({
  name: Yup.string().required('Name is required'),
});

const CohortsPage: React.FC = () => {
  const history = useHistory();
  const [cohort, createCohort, updateCohort] = useCohort();
  const [rules, addRule, removeRule] = useRules();

  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleCondition, setNewRuleCondition] = useState('');
  const [newRuleReward, setNewRuleReward] = useState('');

  const handleSubmit = async (values: Cohort) => {
    if (!cohort.id) {
      await createCohort(values);
    } else {
      await updateCohort(cohort.id, values);
    }
    history.push('/cohorts');
  };

  const handleAddRule = () => {
    if (newRuleName && newRuleCondition && newRuleReward) {
      addRule({ name: newRuleName, condition: newRuleCondition, reward: newRuleReward });
      setNewRuleName('');
      setNewRuleCondition('');
      setNewRuleReward('');
    }
  };

  const handleRemoveRule = (ruleId: number) => {
    removeRule(ruleId);
  };

  return (
    <div>
      <h1>Cohorts Admin</h1>
      <Link to="/cohorts">Back to Cohorts List</Link>
      <Formik
        initialValues={{ name: cohort.name || '' }}
        validationSchema={validationSchema}
        onSubmit={handleSubmit}
      >
        {({ errors, touched }) => (
          <Form>
            <Field name="name" component={TextInput} label="Cohort Name" />
            <ErrorMessage name="name" component="div" />

            <h2>Rules</h2>
            <ul>
              {rules.map((rule) => (
                <li key={rule.id}>
                  {rule.condition} - {rule.reward}
                  <Button onClick={() => handleRemoveRule(rule.id)}>Delete</Button>
                </li>
              ))}
            </ul>

            <div>
              <label htmlFor="new-rule-name">New Rule Name:</label>
              <input id="new-rule-name" value={newRuleName} onChange={(e) => setNewRuleName(e.target.value)} />
            </div>
            <div>
              <label htmlFor="new-rule-condition">New Rule Condition:</label>
              <input id="new-rule-condition" value={newRuleCondition} onChange={(e) => setNewRuleCondition(e.target.value)} />
            </div>
            <div>
              <label htmlFor="new-rule-reward">New Rule Reward:</label>
              <input id="new-rule-reward" value={newRuleReward} onChange={(e) => setNewRuleReward(e.target.value)} />
            </div>
            <Button onClick={handleAddRule}>Add Rule</Button>

            <Button type="submit">Save Cohort</Button>
          </Form>
        )}
      </Formik>
    </div>
  );
};

export default CohortsPage;
```

SQL:

```sql
-- Cohorts table
CREATE TABLE IF NOT EXISTS cohorts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL
);

-- Rules table
CREATE TABLE IF NOT EXISTS rules (
  id SERIAL PRIMARY KEY,
  cohort_id INTEGER REFERENCES cohorts(id),
  name VARCHAR(255) NOT NULL,
  condition TEXT NOT NULL,
  reward TEXT NOT NULL
);
```

Bash:

```bash
#!/bin/sh
set -euo pipefail
echo "Action: $0"
```

Terraform (assuming AWS RDS):

```hcl
resource "aws_db_instance" "cohorts_db" {
  allocated_storage      = 20
  storage_type           = "gp2"
  engine                 = "postgres"
  engine_version         = "13.4"
  instance_class         = "db.t2.micro"
  username               = "cohorts_user"
  password               = "secret_password"
  db_name                = "cohorts"
  skip_final_snapshot    = true
}

resource "aws_db_instance_parameter_group" "cohorts_pg" {
  name   = "cohorts-pg"
  family = "postgres13"

  parameter {
    name  = "log_statement"
    value = "all"
  }
}

resource "aws_db_instance_parameter_group_association" "cohorts_pg_assoc" {
  db_instance_identifier = aws_db_instance.cohorts_db.id
  parameter_group_name   = aws_db_instance_parameter_group.cohorts_pg.name
}
