import type { AuthResponse, UserProfile } from '@flota/protocol';

const BASE = '/api';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };
  if (options.body !== undefined) {
    headers['content-type'] = 'application/json';
  }
  if (token !== undefined) {
    headers.authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE}${path}`, { ...options, headers });
  if (response.status === 204) {
    return undefined as T;
  }

  const data = (await response.json().catch(() => null)) as {
    error?: { code?: string; message?: string };
  } | null;

  if (!response.ok) {
    throw new ApiError(
      response.status,
      data?.error?.code ?? 'INTERNAL',
      data?.error?.message ?? 'Unexpected error',
    );
  }
  return data as T;
}

export interface Credentials {
  email: string;
  password: string;
}

export interface RegisterInput extends Credentials {
  displayName: string;
}

export const api = {
  register: (input: RegisterInput): Promise<AuthResponse> =>
    request<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(input) }),

  login: (input: Credentials): Promise<AuthResponse> =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(input) }),

  refresh: (refreshToken: string): Promise<AuthResponse> =>
    request<AuthResponse>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),

  logout: (refreshToken: string): Promise<void> =>
    request<void>('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) }),

  me: (token: string): Promise<UserProfile> => request<UserProfile>('/me', {}, token),
};
