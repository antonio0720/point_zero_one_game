import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import { v4 as uuidv4 } from 'uuid';

interface UserData {
id: string;
saveData: any;
}

const docClient = new DocumentClient();
const tableName = 'user_data';

async function createUser(userId: string, data: any): Promise<void> {
const params = {
TableName: tableName,
Item: {
id: userId,
saveData: data,
},
};
await docClient.put(params).promise();
}

async function getUserData(userId: string): Promise<UserData | null> {
const params = { TableName: tableName, Key: { id: userId } };
const result = await docClient.get(params).promise();
return result.Item ? { id: result.Item.id, saveData: result.Item.saveData } : null;
}

async function updateUserData(userId: string, data: any): Promise<void> {
const user = await getUserData(userId);
if (user) {
const params = {
TableName: tableName,
Key: { id: userId },
UpdateExpression: 'SET saveData = :saveData',
ExpressionAttributeValues: {
':saveData': data,
},
};
await docClient.update(params).promise();
} else {
createUser(userId, data);
}
}

function generateUuid(): string {
return uuidv4();
}

export { createUser, getUserData, updateUserData, generateUuid };
