/**
 * Report Templates
 */

export interface InstitutionReportTemplate {
  id: number;
  name: string;
  schema: JsonSchema;
  metadata: LayoutMetadata;
}

interface JsonSchema {
  type: string;
  properties: { [key: string]: JsonProperty };
  required: string[];
}

interface JsonProperty {
  type: string;
  description?: string;
}

interface LayoutMetadata {
  title: string;
  subtitle: string;
  // Additional metadata fields as needed...
}

// Example Institution Report Template
const INSTITUTION_REPORT_TEMPLATE_1: InstitutionReportTemplate = {
  id: 1,
  name: 'Financial Statement',
  schema: {
    type: 'object',
    properties: {
      institutionName: { type: 'string' },
      totalAssets: { type: 'number' },
      totalLiabilities: { type: 'number' },
      netWorth: { type: 'number' },
      // Additional properties as needed...
    },
    required: ['institutionName', 'totalAssets', 'totalLiabilities', 'netWorth'],
  },
  metadata: {
    title: 'Financial Statement',
    subtitle: 'A summary of the institution\'s financial status.',
    // Additional metadata fields as needed...
  },
};

This TypeScript code defines an `InstitutionReportTemplate` interface with properties for the template's id, name, schema, and metadata. The `JsonSchema` and `JsonProperty` interfaces are used to describe the structure of the JSON data that will be rendered in the report. The example `INSTITUTION_REPORT_TEMPLATE_1` provides a concrete instance of an institution report template with a simple financial statement schema.
