/**
 * Export Service for handling PDF/CSV generation jobs, signed URLs, retention TTL, and audit receipts.
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import * as jimp from 'jimp';
import * as sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { S3 } from 'aws-sdk';
import { S3Service } from '../s3/s3.service';
import { ExportJob, ExportJobDocument } from './export-job.schema';

const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET;

@Injectable()
export class ExportService {
  constructor(
    @InjectModel(ExportJob.name) private readonly exportJobModel: Model<ExportJobDocument>,
    private readonly s3Service: S3Service,
  ) {}

  /**
   * Generate a new PDF/CSV export job and save it to the database.
   * @param {string} fileType - The type of file to generate (either 'pdf' or 'csv').
   * @param {string[]} data - The data to be included in the generated file.
   */
  async createExportJob(fileType: string, data: string[]): Promise<ExportJob> {
    const job = new this.exportJobModel({
      id: uuidv4(),
      fileType,
      data,
      createdAt: new Date(),
    });
    await job.save();
    return job;
  }

  /**
   * Generate the specified file and save it to AWS S3 with a signed URL.
   * @param {ExportJob} exportJob - The export job to generate the file for.
   */
  async generateAndSaveFile(exportJob: ExportJob): Promise<string> {
    const fileType = exportJob.fileType;
    const data = exportJob.data;
    let outputFilePath;

    if (fileType === 'pdf') {
      // Convert the data to a PNG image using Jimp, then convert it back to a PDF using Sharp.
      const pdfBuffer = await sharp(jimp.bufferToJimp(Buffer.from(data))).toBuffer({ resolution: 300 });
      outputFilePath = path.join(__dirname, `../temp/${exportJob.id}.pdf`);
      fs.writeFileSync(outputFilePath, pdfBuffer);
    } else if (fileType === 'csv') {
      // Write the data to a CSV file directly.
      outputFilePath = path.join(__dirname, `../temp/${exportJob.id}.csv`);
      fs.writeFileSync(outputFilePath, data.join('\n'));
    } else {
      throw new Error('Unsupported file type');
    }

    const signedUrl = await this.s3Service.uploadAndGetSignedUrl(AWS_S3_BUCKET, exportJob.id, outputFilePath);
    fs.unlinkSync(outputFilePath); // Clean up the temporary file after uploading it to S3.
    await this.exportJobModel.findByIdAndUpdate(exportJob.id, { signedUrl, retentionTtl: 60 * 60 * 24 * 7 }); // Update the export job with the signed URL and a retention TTL of 1 week.
    return signedUrl;
  }
}
