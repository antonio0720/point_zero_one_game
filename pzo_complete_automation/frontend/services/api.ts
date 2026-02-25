import { Scenario } from '../models/Scenario';

const BASE_URL = process.env.REACT_APP_API_URL ?? 'http://localhost:3001';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    throw new Error(`API ${options.method ?? 'GET'} ${path} failed (${res.status}): ${body}`);
  }
  return res.json() as Promise<T>;
}

export async function addScenario(scenario: Scenario): Promise<Scenario & { id: string }> {
  return request<Scenario & { id: string }>('/scenarios', {
    method: 'POST',
    body:   JSON.stringify(scenario),
  });
}

export async function getScenarios(): Promise<Array<Scenario & { id: string }>> {
  return request<Array<Scenario & { id: string }>>('/scenarios');
}

export async function deleteScenario(id: string): Promise<void> {
  await request<void>(`/scenarios/${id}`, { method: 'DELETE' });
}
