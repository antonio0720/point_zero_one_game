import express from 'express';
import bodyParser from 'body-parser';
import { DocumentClient } from 'aws-sdk/clients/dynamodb';

const app = express();
app.use(bodyParser.json());

const tableName = process.env.FEATURE_FLAGS_TABLE;
const region = process.env.AWS_REGION;
const accessKeyId = process.env.ACCESS_KEY_ID;
const secretAccessKey = process.env.SECRET_ACCESS_KEY;

const dynamoDBClient = new DocumentClient({
region,
accessKeyId,
secretAccessKey,
});

async function getFeatureFlag(flagName: string) {
const params = {
TableName: tableName,
Key: {
name: flagName,
},
};

try {
const data = await dynamoDBClient.get(params).promise();
return data.Item?.value || false;
} catch (error) {
console.error(`Error getting feature flag ${flagName}:`, error);
throw error;
}
}

app.get('/:featureFlag', async (req, res) => {
const flagName = req.params.featureFlag;
try {
const value = await getFeatureFlag(flagName);
res.json({ success: true, value });
} catch (error) {
res.status(500).json({ success: false, error: error.message });
}
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Feature Flags service listening on port ${port}`));
