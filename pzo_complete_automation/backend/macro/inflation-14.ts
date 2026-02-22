Here is a TypeScript code for an inflation calculation function in a macro system. This example uses an annual inflation rate and consumer price index (CPI) data.

```typescript
interface InflationData {
year: number;
cpi: number;
}

function calculateInflation(prevData: InflationData, currentData: InflationData): number {
const prevCpi = prevData.cpi;
const currentCpi = currentData.cpi;
return (currentCpi / prevCpi) - 1;
}
```

You can use this function to calculate the inflation rate between two consecutive years in your application. This example uses an interface for InflationData, which could be replaced with a class or other data structure based on your specific requirements.
