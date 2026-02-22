import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

class AdminShellClient {
private instance: AxiosInstance;

constructor(baseURL: string) {
this.instance = axios.create({ baseURL });
}

async get(url: string, config?: AxiosRequestConfig): Promise<any> {
return this.instance.get(url, config);
}

async post(url: string, data?: any, config?: AxiosRequestConfig): Promise<any> {
return this.instance.post(url, data, config);
}
}

export default AdminShellClient;
