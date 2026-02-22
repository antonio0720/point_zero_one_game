import { Mechanic } from './Mechanic';

// Function to ingest new mechanics
export async function ingestMechanics(mechanics: Mechanic[]): Promise<void> {
// Assuming you have an API endpoint and access token for ingesting the data
const apiUrl = 'https://api.example.com/v1/mechanics';
const authToken = 'your_auth_token';

const mechanicsData: any[] = mechanics.map((mech) => ({
name: mech.name,
description: mech.description,
// Add more properties as needed
}));

const headers = {
Authorization: `Bearer ${authToken}`,
'Content-Type': 'application/json',
};

for (const mechanic of mechanicsData) {
try {
const response = await fetch(apiUrl, {
method: 'POST',
headers,
body: JSON.stringify(mechanic),
});

if (!response.ok) {
throw new Error(`Failed to ingest mechanic "${mechanic.name}". Status ${response.status}`);
}
} catch (error) {
console.error(`Error ingesting mechanic "${mechanic.name}":`, error);
}
}
}
