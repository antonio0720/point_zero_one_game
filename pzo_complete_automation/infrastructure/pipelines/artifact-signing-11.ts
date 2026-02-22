import { SSMClient, GetParametersCommand, PutParameterCommand,AWSAccountId, KmsKeyId } from "@aws-sdk/client-ssm";
import { SESClient, SendRawEmailCommand } from "@aws-sdk/client-ses";
import { GithubActions } from "github-actions";
import * as ec from "@aws-crypto/s3";

const github = GithubActions();
const region = process.env.AWS_REGION;
const artifactBucketName = process.env.ARTIFACT_BUCKET;
const artifactKey = `${github.context.eventName}/${github.context.ref}/artifact`;
const kmsKeyArn = process.env.KMS_KEY_ARN;
const recipientEmail = process.env.RECIPIENT_EMAIL;
const fromEmail = process.env.FROM_EMAIL;
const sesRegion = process.env.SES_REGION || region;

const ssmClient = new SSMClient({region});
const ssmGetParamsCommand = new GetParametersCommand({
Names: [kmsKeyArn],
WithDecryption: true,
});

async function getKmsKeyId(): Promise<KmsKeyId> {
const response = await ssmClient.send(ssmGetParamsCommand);
return response.Parameters[0].Value;
}

const sesClient = new SESClient({region: sesRegion});
async function sendEmail(subject: string, body: string): Promise<void> {
const rawBody = `From: ${fromEmail}\r\n` +
`To: ${recipientEmail}\r\n` +
`Subject: ${subject}\r\n\r\n` +
`${body}`;
await sesClient.send(new SendRawEmailCommand({RawMessageBytes: Buffer.from(rawBody)}));
}

const s3EncryptionClient = ec.S3EncryptionClient.fromS3EncryptionV2Configuration({kmsKeyId: await getKmsKeyId()});

async function signArtifact(): Promise<void> {
const artifactInS3 = s3EncryptionClient.encrypt({ Key: artifactKey, Bucket: artifactBucketName });
const encryptedArtifact = await artifactInS3.promise();
await putParameter(encryptedArtifact.CiphertextBlob.toString("base64"));
}

async function putParameter(paramValue: string): Promise<void> {
const putParamCommand = new PutParameterCommand({
Name: "signed_artifact",
Value: paramValue,
Type: "SecureString"
});
await ssmClient.send(putParamCommand);
}

async function main(): Promise<void> {
if (github.context.eventName !== 'push') {
console.log('Only triggered by push events');
process.exit(0);
}
await signArtifact();
await sendEmail('Artifact signed', `Signed artifact for commit ${github.context.sha} has been uploaded to S3`);
}

main().catch((error) => console.log(error));
