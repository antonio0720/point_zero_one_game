import axios from 'axios';
import qs from 'qs';

class CreatorShell6Client {
private baseURL = 'https://api.example.com/v1';
private headers: any;

constructor(options?: any) {
this.headers = {
Accept: 'application/json',
'Content-Type': 'application/json'
};

if (options && options.headers) {
Object.assign(this.headers, options.headers);
}
}

async get(path: string, params?: any): Promise<any> {
const url = `${this.baseURL}/${path}`;
if (params) {
const queryParams = qs.stringify(params);
url += `?${queryParams}`;
}
return axios.get(url, { headers: this.headers });
}

async post(path: string, data?: any): Promise<any> {
const url = `${this.baseURL}/${path}`;
return axios.post(url, data, { headers: this.headers });
}
}

export default CreatorShell6Client;
