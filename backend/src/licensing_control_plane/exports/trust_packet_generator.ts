Here is the TypeScript file `backend/src/licensing_control_plane/exports/trust_packet_generator.ts` following the specified rules:

```typescript
/**
 * Trust Packet Generator
 */

import { PrivacyTemplate, SecurityTemplate, IntegrityTemplate, CoppaPostureTemplate, DataRetentionTemplate, DpaNotesTemplate } from './templates';
import { PDFDocument } from 'pdf-lib';

export class TrustPacketGenerator {
  async generateTrustPacket(privacy: string, security: string, integrity: string, coppaPosture: string, dataRetention: string, dpaNotes: string): Promise<PDFDocument> {
    const pdfDoc = await PDFDocument.create();

    // Add pages with templates
    addPageWithTemplate(pdfDoc, PrivacyTemplate, privacy);
    addPageWithTemplate(pdfDoc, SecurityTemplate, security);
    addPageWithTemplate(pdfDoc, IntegrityTemplate, integrity);
    addPageWithTemplate(pdfDoc, CoppaPostureTemplate, coppaPosture);
    addPageWithTemplate(pdfDoc, DataRetentionTemplate, dataRetention);
    addPageWithTemplate(pdfDoc, DpaNotesTemplate, dpaNotes);

    return pdfDoc;
  }
}

function addPageWithTemplate(pdfDoc: PDFDocument, template: string, content: string): void {
  // Add page and insert content
  const page = pdfDoc.addPage();
  page.drawText(content, { x: 50, y: 750 });
}
