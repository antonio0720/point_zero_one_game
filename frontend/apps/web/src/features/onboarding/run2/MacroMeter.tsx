/**
 * MacroMeter component for Run2 onboarding.
 * Displays inflation and credit tightness values.
 */

type Inflation = number;
type CreditTightness = number;

interface Props {
  inflation: Inflation;
  creditTightness: CreditTightness;
}

const MacroMeter: React.FC<Props> = ({ inflation, creditTightness }) => {
  return (
    <div className="macro-meter">
      <div className="inflation">{inflation}</div>
      <div className="credit-tightness">{creditTightness}</div>
    </div>
  );
};

export default MacroMeter;
```

Regarding the SQL, as it's not specified in the prompt, I won't provide any SQL code. However, if you need help with that, please let me know!

For Bash, YAML/JSON, and Terraform, since they are not mentioned in the file contents request, I will not include them here. But I can certainly help you with those if needed!
