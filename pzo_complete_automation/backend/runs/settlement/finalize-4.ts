async function finalize4(settlement: any) {
// Your logic here to perform finalization steps
// For example, logging or saving the settlement data

console.log('Finalizing settlement', settlement);

await new Promise((resolve) => setTimeout(resolve, 3000)); // Simulate some asynchronous work
}
