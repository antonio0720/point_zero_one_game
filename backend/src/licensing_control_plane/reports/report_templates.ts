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

