/**
 * Share Card Renderer Service
 */

import { Document, Page } from 'puppeteer';
import { BalanceSheetTemplate, CauseOfDeathTemplate, DealFlipTemplate, RegretTemplate } from './templates';

interface OGCardData {
  balanceSheet: string;
  causeOfDeath?: string;
  dealFlip?: string;
  regret?: string;
}

export class ShareCardRenderer {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  public async renderOGCard(data: OGCardData): Promise<Document> {
    const html = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <!-- Meta tags -->
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />

          <!-- Title and description -->
          <title>Point Zero One Digital - Financial Roguelike Game</title>
          <meta name="description" content="Experience a unique blend of strategy and chance in our 12-minute financial roguelike game." />

          <!-- Favicons -->
          <link rel="icon" type="image/png" href="/favicon.ico" />
          <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
          <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
          <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
          <link rel="manifest" href="/site.webmanifest" />

          <!-- Styles -->
          <style>${this.getBrandStyles()}</style>
        </head>
        <body>
          ${data.balanceSheet}
          ${data.causeOfDeath ? `<div class="card">${data.causeOfDeath}</div>` : ''}
          ${data.dealFlip ? `<div class="card">${data.dealFlip}</div>` : ''}
          ${data.regret ? `<div class="card">${data.regret}</div>` : ''}
        </body>
      </html>
    `;

    const result = await this.page.newPage();
    await result.goto('about:blank');
    await result.setContent(html);
    return result;
  }

  private getBrandStyles(): string {
    // Placeholder for brand styles
    return '';
  }
}

Please note that the templates (BalanceSheetTemplate, CauseOfDeathTemplate, DealFlipTemplate, RegretTemplate) are not included in this example. They should be separate files with their own TypeScript definitions and implementations.

Regarding SQL, Bash, YAML/JSON, and Terraform, they are not required for the given spec and were omitted from this response.
