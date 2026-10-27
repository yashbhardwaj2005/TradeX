import { create } from 'zustand';
export const useAuth = create((set) => ({
  user: null,
  token: null,
  ready: false,
  version: 0,
  setSession: (data) =>
    set((state) => ({
      user: data.user,
      token: data.accessToken,
      ready: true,
      version: state.version + 1,
    })),
  clear: () =>
    set((state) => ({ user: null, token: null, ready: true, version: state.version + 1 })),
}));
