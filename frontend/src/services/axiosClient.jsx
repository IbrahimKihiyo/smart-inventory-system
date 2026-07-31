import axios from 'axios';
import * as SecureStore from './secureStorage';
import API_URL from './apiUrl';

const axiosClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 15000,
});

// REQUEST INTERCEPTOR
axiosClient.interceptors.request.use(
  async (config) => {
    try {
      const token = await SecureStore.getItemAsync('auth_token');
      const slug = await SecureStore.getItemAsync('tenant_slug');

      // DEBUG (VERY IMPORTANT FOR YOUR BUG)
      console.log('API CALL →', config.url);
      console.log('Tenant slug →', slug);

      // Auth token
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      // IMPORTANT FIX:
      // Always send X-Tenant header (even if null for debugging)
      config.headers['X-Tenant'] = slug || '';

    } catch (error) {
      console.error('Interceptor error reading SecureStore:', error);
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// RESPONSE INTERCEPTOR
axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      console.log('Backend Error Status:', error.response.status);
      console.log('Backend Error Data:', error.response.data);
    } else {
      console.log('Network/Error (no response from server):', error.message);
    }

    if (error.response?.status === 401) {
      console.warn('Session expired or unauthorized');
    }

    return Promise.reject(error);
  }
);

export default axiosClient;