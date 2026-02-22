import { BanStateMachine } from "../../ban-state-machine";
import { BanReason } from "../../entities/BanReason";
import { User } from "../../entities/User";
import { createMockContext } from "@aws-sdk/lambda/mock";
import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { APIGatewayProxyHandlerV2 } from "aws-lambda";

jest.mock("../../services/dynamoDbService");

const dynamoDBClient = new DynamoDBClient({ region: "us-west-2" });

describe("Ban State Machine - Ban-State-Machine-3", () => {
let banStateMachine;

beforeAll(() => {
banStateMachine = new BanStateMachine();
});

const user = new User({
id: uuidv4(),
username: "testUser",
email: "test@example.com",
});

const banReason = new BanReason("Test Reason");

const mockContext = createMockContext();

const mockGetItemCommand = {
promise: jest.fn().mockResolvedValue({ Item: user }),
};

beforeEach(() => {
dynamoDBClient.send = jest.fn().mockImplementation((params) => {
if (params instanceof GetItemCommand) {
return mockGetItemCommand;
}
});
});

it("should update the ban state to 'BANNED' when a user is abusive", async () => {
const event = {
detail: {
user,
reason: banReason,
},
};

mockGetItemCommand.params = { TableName: "Users", Key: { id: user.id } };

await banStateMachine.handle(event as APIGatewayProxyHandlerV2, mockContext);

expect(dynamoDBClient.send).toHaveBeenCalledTimes(1);
expect(mockGetItemCommand.params.Item.banState).toEqual("BANNED");
});

it("should fail to update the ban state when a user is not found", async () => {
mockGetItemCommand.params = { TableName: "Users", Key: { id: uuidv4() } };

await expect(banStateMachine.handle).toThrowError(/User not found/);
});
});
