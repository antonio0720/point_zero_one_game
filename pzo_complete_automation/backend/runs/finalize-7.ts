import { Context } from "@serverless/typescript";

export function finalize(event: any, context: Context) {
console.log('Executing finalize event');

// Perform the necessary cleanup or finalization tasks here

context.succeed({
statusCode: 200,
body: JSON.stringify({ message: 'Finalize completed successfully' })
});
}
