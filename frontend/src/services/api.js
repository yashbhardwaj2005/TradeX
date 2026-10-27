import axios from 'axios';
import { useAuth } from '../store/auth';
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  withCredentials: true,
  timeout: 15000,
});
api.interceptors.request.use((config) => {
  const token = useAuth.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
let refreshPromise;
export async function restoreSession() {
  if (!refreshPromise) {
    const version = useAuth.getState().version;
    refreshPromise = api
      .post('/auth/refresh')
      .then(({ data }) => {
        if (useAuth.getState().version !== version)
          throw new Error('The session changed during refresh.');
        useAuth.getState().setSession(data.data);
        return data.data;
      })
      .catch((error) => {
        // A temporary outage must not destroy a valid in-memory session.
        if (error.response?.status === 401 && useAuth.getState().version === version)
          useAuth.getState().clear();
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    const sessionEndpoint = [
      '/auth/login',
      '/auth/register',
      '/auth/refresh',
      '/auth/logout',
    ].includes(config?.url);
    if (error.response?.status === 401 && !config._retry && !sessionEndpoint) {
      config._retry = true;
      await restoreSession();
      return api(config);
    }
    return Promise.reject(error);
  },
);
export const get = async (url, params) => (await api.get(url, { params })).data.data;
export const errorMessage = (error) =>
  error.response?.data?.error?.message ||
  (error.code === 'ECONNABORTED'
    ? 'The server took too long. Please try again.'
    : 'Unable to reach TradeX. Check that the API is running.');
