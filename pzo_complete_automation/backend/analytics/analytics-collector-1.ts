import axios from 'axios';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

class AnalyticsCollector {
private apiUrl: string;

constructor() {
this.apiUrl = process.env.ANALYTICS_API_URL || '';
}

public async sendEvent(eventName: string, properties: any) {
try {
await axios.post(`${this.apiUrl}/events`, { eventName, properties });
} catch (error) {
console.error(`Error sending event: ${eventName}. Error: ${error}`);
}
}
}

export default AnalyticsCollector;
