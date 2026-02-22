/**
 * PDFGenerator service for generating print-ready PDFs from Markdown files using pdfkit.
 */
import { Document, Font, PDFDocument } from 'pdfkit';
import fs from 'fs';
import path from 'path';

interface Options {
  /** The output buffer of the generated PDF. */
  buffer: Buffer;
}

/**
 * Converts Host_QuickCard.md and Moment_Codes_TableTent.md to print-ready PDFs using pdfkit, letter size, high contrast.
 * @param {Options} options - Options for generating the PDF.
 */
export function generatePDF(options: Options): void {
  const hostQuickCardPath = path.join(__dirname, '..', 'assets', 'Host_QuickCard.md');
  const momentCodesTableTentPath = path.join(__dirname, '..', 'assets', 'Moment_Codes_TableTent.md');

  const pdfDoc = new PDFDocument({ size: 'letter' });
  pdfDoc.pipe(options.buffer);

  // Load high contrast font
  Font.register({ family: 'Helvetica Neue', fontStyle: 'Bold', src: path.join(__dirname, '..', 'assets', 'HelveticaNeue-Bold.ttf') });

  // Generate PDF from Host_QuickCard.md
  fs.createReadStream(hostQuickCardPath).pipe(pdfDoc);
  pdfDoc.text('Host Quick Card', { font: 'Helvetica Neue-Bold' });
  pdfDoc.moveDown();

  // Generate PDF from Moment_Codes_TableTent.md
  fs.createReadStream(momentCodesTableTentPath).pipe(pdfDoc);
  pdfDoc.text('Moment Codes Table Tent', { font: 'Helvetica Neue-Bold' });
  pdfDoc.moveDown();

  // Finalize and end PDF generation
  pdfDoc.end();
}
