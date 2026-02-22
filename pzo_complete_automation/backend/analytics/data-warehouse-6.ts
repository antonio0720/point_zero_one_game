import { DataSource } from "typeorm";
import AWS from "aws-sdk";

const s3 = new AWS.S3();
const dataSource = new DataSource({
// database connection options here (e.g., postgres, mysql)
});

async function createConnection() {
await dataSource.initialize();
console.log("Data source initialized");
}

class AnalyticsRepository {
private repository;

constructor() {
this.repository = dataSource.getRepository("Analytics");
}

async storeAnalytics(analytics: any) {
await this.repository.save(analytics);
}
}

async function uploadToS3(fileBuffer: Buffer, key: string) {
const params = {
Bucket: "your-bucket-name",
Key: key,
Body: fileBuffer,
ContentType: fileBuffer.toString("base64"),
};

return s3.upload(params).promise();
}

// Usage example
const repository = new AnalyticsRepository();
const analyticsData = { /* your data here */ };
repository.storeAnalytics(analyticsData);

createConnection().then(() => {
// After the connection is established, you can perform operations
});
