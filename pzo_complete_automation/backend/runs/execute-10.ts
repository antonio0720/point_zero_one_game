async function executeOperation(): Promise<void> {
try {
const result = await someAsyncFunction(); // Replace this with your actual async function

console.log('Result:', result);
} catch (error) {
console.error('Error:', error);
throw error;
}
}
