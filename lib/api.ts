const BASE_URL = 'http://localhost:5000';

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  statusCode?: number;
  data: T;
}

export const api = {
  async get<T>(path: string, token?: string): Promise<ApiResponse<T>> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'GET',
      headers,
    });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      return { success: res.ok, message: text, data: null as any };
    }
  },

  async post<T>(path: string, body: any, isMultipart = false, token?: string): Promise<ApiResponse<T>> {
    const headers: HeadersInit = {};
    if (!isMultipart) headers['Content-Type'] = 'application/json';
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers,
      body: isMultipart ? body : JSON.stringify(body),
    });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      return { success: res.ok, message: text, data: null as any };
    }
  },

  async patch<T>(path: string, body: any, isMultipart = false, token?: string): Promise<ApiResponse<T>> {
    const headers: HeadersInit = {};
    if (!isMultipart) headers['Content-Type'] = 'application/json';
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'PATCH',
      headers,
      body: isMultipart ? body : JSON.stringify(body),
    });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      return { success: res.ok, message: text, data: null as any };
    }
  },

  async delete<T>(path: string, token?: string): Promise<ApiResponse<T>> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'DELETE',
      headers,
    });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      return { success: res.ok, message: text, data: null as any };
    }
  },
};
