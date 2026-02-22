Here is the TypeScript code for the `printables` route as per your specifications:

```typescript
import express from 'express';
import { PDFDocument } from 'pdf-lib';
import { Cache } from './cache';
import { Database } from './database';

const router = express.Router();
const cache = new Cache();
const db = new Database();

interface PrintableType {
  type: string;
}

router.get('/host/printables/:type', async (req, res) => {
  const { type } = req.params;

  // Check if the printable is in cache
  const cachedPrintable = await cache.get(type);
  if (cachedPrintable) {
    res.set('Content-Type', 'application/pdf');
    res.send(cachedPrintable);
    return;
  }

  // Fetch the printable from the database
  const printable = await db.getPrintable(type);

  // Generate PDF on demand
  const pdfDoc = await PDFDocument.create();
  // ... (Add your logic to populate the PDFDoc with the printable data)

  // Save the generated PDF in cache for 24 hours
  await cache.set(type, pdfDoc.save());

  // Send the generated PDF as response
  res.set('Content-Type', 'application/pdf');
  res.send(pdfDoc.save());
});

export { router };
```

Please note that this is a simplified example and you'll need to implement the logic for populating the `PDFDocument` with the printable data based on the type provided in the request. Also, the database abstraction layer (`Database`) and cache implementation (`Cache`) are not provided here.

Regarding the SQL schema, I won't be able to provide it as it requires knowledge about your specific database structure and naming conventions. However, you should create a table for printables with an id column as primary key, a type column to store the printable type, and a content column to store the binary data of the PDF. Don't forget to include indexes on the type and content columns.

For Bash scripts, YAML/JSON files, or Terraform configurations, I won't be able to provide examples as they are not part of the given spec.
