import axios from 'axios';

export class WebShellClient {
private baseUrl = 'https://api.examplesite.com/v1';
private apiKey: string;

constructor(apiKey: string) {
this.apiKey = apiKey;
}

async getData(): Promise<any> {
const response = await axios.get(`${this.baseUrl}/data`, {
headers: {
'Api-Key': this.apiKey,
},
});

return response.data;
}
}
