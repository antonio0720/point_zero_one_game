import axios from 'axios';

class CreatorShellAPIClient {
private baseURL = 'https://api.creatorshell.com/v10';

constructor(private token: string) {}

public async getUserProfile(): Promise<any> {
const response = await axios.get(`${this.baseURL}/user-profile`, {
headers: { Authorization: `Bearer ${this.token}` },
});
return response.data;
}

public async createProject(projectData: any): Promise<any> {
const response = await axios.post(`${this.baseURL}/projects`, projectData, {
headers: { Authorization: `Bearer ${this.token}` },
});
return response.data;
}
}
