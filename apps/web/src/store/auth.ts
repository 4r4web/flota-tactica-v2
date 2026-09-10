import type { AuthResponse, UserProfile } from '@flota/protocol';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { api } from '../api/rest';
import type { Credentials, RegisterInput } from '../api/rest';

interface AuthState {
  user: UserProfile | null;
  accessToken: string | null;
  refreshToken: string | null;
  register: (input: RegisterInput) => Promise<void>;
  login: (input: Credentials) => Promise<void>;
  logout: () => Promise<void>;
}

function applySession(
  auth: AuthResponse,
): Pick<AuthState, 'user' | 'accessToken' | 'refreshToken'> {
  return { user: auth.user, accessToken: auth.accessToken, refreshToken: auth.refreshToken };
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,

      async register(input) {
        const auth = await api.register(input);
        set(applySession(auth));
      },

      async login(input) {
        const auth = await api.login(input);
        set(applySession(auth));
      },

      async logout() {
        const { refreshToken } = get();
        if (refreshToken !== null) {
          await api.logout(refreshToken).catch(() => undefined);
        }
        set({ user: null, accessToken: null, refreshToken: null });
      },
    }),
    { name: 'flota-auth' },
  ),
);
