import axios from 'axios';

class AdminShell3Client {
private baseUrl = 'https://your-api-url.com/admin-shell-3';

constructor(options?: any) {
this.setupAxiosInstance(options);
}

private setupAxiosInstance(options: any) {
axios.defaults.baseURL = this.baseUrl;
if (options && options.headers) {
axios.defaults.headers.common = options.headers;
}
}

public async getVersion(): Promise<string> {
const response = await axios.get(`${this.baseUrl}/version`);
return response.data as string;
}

// Add other methods for Admin Shell API calls here
}

export default AdminShell3Client;
