/**
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/host-os/services/pdf-generator.ts
 *
 * Zero-dependency PDF generator for Host OS printable assets.
 *
 * Why this implementation:
 * - The current Host OS package does not include `pdfkit`
 * - TypeScript is configured for Node 20 CommonJS
 * - This implementation compiles and runs without adding dependencies
 *
 * Output:
 * - A valid PDF buffer built from Markdown assets
 * - Optional write-to-disk helper
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

export interface PdfSourceDocument {
  title: string;
  filePath: string;
}

export interface GeneratePdfOptions {
  sourceDocuments?: readonly PdfSourceDocument[];
  outputPath?: string;
  title?: string;
  author?: string;
  subject?: string;
  pageWidth?: number;
  pageHeight?: number;
  marginLeft?: number;
  marginTop?: number;
  lineHeight?: number;
  bodyFontSize?: number;
  titleFontSize?: number;
  sectionTitleFontSize?: number;
  maxCharsPerLine?: number;
  maxLinesPerPage?: number;
}

interface RenderLine {
  text: string;
  fontSize: number;
}

interface PdfObject {
  id: number;
  body: string;
}

const LETTER_WIDTH = 612;
const LETTER_HEIGHT = 792;

const DEFAULT_SOURCE_DOCUMENTS: readonly PdfSourceDocument[] = Object.freeze([
  {
    title: 'Host Quick Card',
    filePath: path.join(__dirname, '..', 'assets', 'Host_QuickCard.md'),
  },
  {
    title: 'Moment Codes Table Tent',
    filePath: path.join(__dirname, '..', 'assets', 'Moment_Codes_TableTent.md'),
  },
]);

function normalizeAscii(input: string): string {
  return input
    .replace(/[•]/g, '-')
    .replace(/[–—]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\t/g, '  ')
    .replace(/[^\x0A\x0D\x20-\x7E]/g, '');
}

function escapePdfText(input: string): string {
  return normalizeAscii(input)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function wrapText(text: string, maxCharsPerLine: number): string[] {
  const normalized = text.trim();

  if (!normalized) {
    return [''];
  }

  if (normalized.length <= maxCharsPerLine) {
    return [normalized];
  }

  const words = normalized.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const tentative = currentLine ? `${currentLine} ${word}` : word;

    if (tentative.length <= maxCharsPerLine) {
      currentLine = tentative;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    if (word.length <= maxCharsPerLine) {
      currentLine = word;
      continue;
    }

    let remainder = word;
    while (remainder.length > maxCharsPerLine) {
      lines.push(remainder.slice(0, maxCharsPerLine - 1) + '-');
      remainder = remainder.slice(maxCharsPerLine - 1);
    }
    currentLine = remainder;
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function markdownToRenderLines(
  markdown: string,
  sectionTitle: string,
  maxCharsPerLine: number,
  sectionTitleFontSize: number,
  bodyFontSize: number,
): RenderLine[] {
  const output: RenderLine[] = [
    { text: sectionTitle, fontSize: sectionTitleFontSize },
    { text: '', fontSize: bodyFontSize },
  ];

  const lines = markdown.replace(/\r/g, '').split('\n');
  let inCodeFence = false;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    if (trimmed.startsWith('```')) {
      inCodeFence = !inCodeFence;
      continue;
    }

    let line = rawLine.trim();

    if (!inCodeFence) {
      line = line
        .replace(/^#{1,6}\s+/, '')
        .replace(/^[-*+]\s+/, '- ')
        .replace(/^>\s+/, '')
        .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/__(.*?)__/g, '$1')
        .replace(/_(.*?)_/g, '$1');
    }

    if (!line) {
      if (output.length === 0 || output[output.length - 1].text !== '') {
        output.push({ text: '', fontSize: bodyFontSize });
      }
      continue;
    }

    const wrapped = wrapText(line, maxCharsPerLine);

    for (const wrappedLine of wrapped) {
      output.push({
        text: wrappedLine,
        fontSize: bodyFontSize,
      });
    }
  }

  output.push({ text: '', fontSize: bodyFontSize });
  return output;
}

function paginateLines(
  lines: readonly RenderLine[],
  maxLinesPerPage: number,
): RenderLine[][] {
  const pages: RenderLine[][] = [];
  let currentPage: RenderLine[] = [];

  for (const line of lines) {
    if (currentPage.length >= maxLinesPerPage) {
      pages.push(currentPage);
      currentPage = [];
    }

    currentPage.push(line);
  }

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  return pages.length > 0 ? pages : [[{ text: 'No content available.', fontSize: 12 }]];
}

function buildContentStream(
  pageLines: readonly RenderLine[],
  pageNumber: number,
  pageWidth: number,
  pageHeight: number,
  marginLeft: number,
  marginTop: number,
  lineHeight: number,
  title: string,
  titleFontSize: number,
): string {
  const commands: string[] = [];

  commands.push('BT');
  commands.push(`/F1 ${titleFontSize} Tf`);
  commands.push(`1 0 0 1 ${marginLeft} ${pageHeight - marginTop} Tm`);
  commands.push(`(${escapePdfText(title)}) Tj`);
  commands.push('ET');

  commands.push('BT');
  commands.push('/F1 10 Tf');
  commands.push(`1 0 0 1 ${pageWidth - 110} 24 Tm`);
  commands.push(`(Page ${pageNumber}) Tj`);
  commands.push('ET');

  let y = pageHeight - marginTop - 30;

  for (const line of pageLines) {
    if (y < 40) {
      break;
    }

    commands.push('BT');
    commands.push(`/F1 ${line.fontSize} Tf`);
    commands.push(`1 0 0 1 ${marginLeft} ${y} Tm`);
    commands.push(`(${escapePdfText(line.text)}) Tj`);
    commands.push('ET');

    y -= lineHeight;
  }

  return commands.join('\n');
}

function buildPdfDocument(
  pageStreams: readonly string[],
  metadata: {
    title: string;
    author: string;
    subject: string;
    pageWidth: number;
    pageHeight: number;
  },
): Buffer {
  const objects: PdfObject[] = [];

  const fontObjectId = 1;
  objects.push({
    id: fontObjectId,
    body: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  });

  const contentObjectIds: number[] = [];
  const pageObjectIds: number[] = [];

  for (let index = 0; index < pageStreams.length; index += 1) {
    contentObjectIds.push(2 + index);
  }

  for (let index = 0; index < pageStreams.length; index += 1) {
    pageObjectIds.push(2 + pageStreams.length + index);
  }

  const pagesObjectId = 2 + pageStreams.length * 2;
  const infoObjectId = pagesObjectId + 1;
  const catalogObjectId = pagesObjectId + 2;

  for (let index = 0; index < pageStreams.length; index += 1) {
    const stream = pageStreams[index];
    objects.push({
      id: contentObjectIds[index],
      body: `<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream`,
    });
  }

  for (let index = 0; index < pageStreams.length; index += 1) {
    objects.push({
      id: pageObjectIds[index],
      body:
        `<< /Type /Page /Parent ${pagesObjectId} 0 R ` +
        `/MediaBox [0 0 ${metadata.pageWidth} ${metadata.pageHeight}] ` +
        `/Resources << /Font << /F1 ${fontObjectId} 0 R >> >> ` +
        `/Contents ${contentObjectIds[index]} 0 R >>`,
    });
  }

  objects.push({
    id: pagesObjectId,
    body:
      `<< /Type /Pages /Count ${pageObjectIds.length} /Kids [` +
      `${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}` +
      `] >>`,
  });

  objects.push({
    id: infoObjectId,
    body:
      `<< /Title (${escapePdfText(metadata.title)}) ` +
      `/Author (${escapePdfText(metadata.author)}) ` +
      `/Subject (${escapePdfText(metadata.subject)}) ` +
      `/Producer (Point Zero One Host OS) >>`,
  });

  objects.push({
    id: catalogObjectId,
    body: `<< /Type /Catalog /Pages ${pagesObjectId} 0 R >>`,
  });

  objects.sort((a, b) => a.id - b.id);

  let pdf = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const xrefOffsets: number[] = [0];

  for (const object of objects) {
    xrefOffsets[object.id] = Buffer.byteLength(pdf, 'utf8');
    pdf += `${object.id} 0 obj\n${object.body}\nendobj\n`;
  }

  const xrefStart = Buffer.byteLength(pdf, 'utf8');
  const objectCount = objects.length + 1;

  pdf += `xref\n0 ${objectCount}\n`;
  pdf += '0000000000 65535 f \n';

  for (let id = 1; id < objectCount; id += 1) {
    const offset = xrefOffsets[id] ?? 0;
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }

  pdf +=
    `trailer\n<< /Size ${objectCount} /Root ${catalogObjectId} 0 R /Info ${infoObjectId} 0 R >>\n` +
    `startxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(pdf, 'utf8');
}

async function readMarkdownSources(
  documents: readonly PdfSourceDocument[],
): Promise<RenderLine[]> {
  const lines: RenderLine[] = [];

  for (const document of documents) {
    const markdown = await fs.readFile(document.filePath, 'utf8');
    lines.push(
      ...markdownToRenderLines(markdown, document.title, 88, 14, 11),
    );
  }

  return lines;
}

export async function generatePDF(
  options: GeneratePdfOptions = {},
): Promise<Buffer> {
  const title = options.title?.trim() || 'Point Zero One Host OS Printables';
  const author = options.author?.trim() || 'Density6 LLC';
  const subject = options.subject?.trim() || 'Host OS printable assets';
  const pageWidth = options.pageWidth ?? LETTER_WIDTH;
  const pageHeight = options.pageHeight ?? LETTER_HEIGHT;
  const marginLeft = options.marginLeft ?? 54;
  const marginTop = options.marginTop ?? 54;
  const lineHeight = options.lineHeight ?? 14;
  const titleFontSize = options.titleFontSize ?? 16;
  const maxLinesPerPage = options.maxLinesPerPage ?? 46;

  const sourceDocuments = options.sourceDocuments ?? DEFAULT_SOURCE_DOCUMENTS;
  const renderLines = await readMarkdownSources(sourceDocuments);
  const pages = paginateLines(renderLines, maxLinesPerPage);

  const pageStreams = pages.map((pageLines, index) =>
    buildContentStream(
      pageLines,
      index + 1,
      pageWidth,
      pageHeight,
      marginLeft,
      marginTop,
      lineHeight,
      title,
      titleFontSize,
    ),
  );

  const buffer = buildPdfDocument(pageStreams, {
    title,
    author,
    subject,
    pageWidth,
    pageHeight,
  });

  if (options.outputPath) {
    await fs.writeFile(options.outputPath, buffer);
  }

  return buffer;
}

export async function generateDefaultHostPrintablePdf(
  outputPath?: string,
): Promise<Buffer> {
  return await generatePDF({
    outputPath,
  });
}

export default generatePDF;