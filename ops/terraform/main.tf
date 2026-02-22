Here is the Terraform configuration file (main.tf) for Point Zero One Digital's infrastructure in strict TypeScript format, adhering to the specified rules:

```typescript
// terraform.ts
import * as aws from "aws-cdk-lib";
import * as cdk from "@aws-cdk/core";
import { NetworkingStack } from "./networking-stack";
import { DbStack } from "./db-stack";
import { CacheStack } from "./cache-stack";
import { ObjectStorageStack } from "./object-storage-stack";
import { MessageBusStack } from "./message-bus-stack";
import { CdnStack } from "./cdn-stack";

const app = new cdk.App();

// Provider configuration
new aws.AwsProvider(app, "AWS", {
  region: "us-west-2", // Replace with the desired AWS region
});

// Remote state configuration
const remoteStateBucketName = "point-zero-one-digital-remote-state";
const remoteStateTableName = "point-zero-one-digital-remote-state-table";

// Output the ARN of the remote state table for easy access during development
output "remote_state_table_arn" {
  value = aws_dynamodb_table.remote_state.arn;
}

// Module references for each infrastructure component
const networking = NetworkingStack.build(app, "Networking");
const db = DbStack.build(app, "Db", networking);
const cache = CacheStack.build(app, "Cache", networking);
const objectStorage = ObjectStorageStack.build(app, "ObjectStorage", networking);
const messageBus = MessageBusStack.build(app, "MessageBus", networking);
const cdn = CdnStack.build(app, "Cdn", networking);

// To ensure idempotency and rollback notes, use the 'depends_on' directive to order the creation of resources
cdn.dependsOn(networking);
messageBus.dependsOn(networking);
objectStorage.dependsOn(networking);
cache.dependsOn(networking);
db.dependsOn(networking);
