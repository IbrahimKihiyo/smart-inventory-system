// src/context/AuthContext.js

import React, { createContext, useState, useEffect } from 'react';
import * as SecureStore from '../services/secureStorage';
import axios from 'axios';
import API_URL from '../services/apiUrl';

export const API = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 10000,
});

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser]           = useState(null);
  const [tenant, setTenant]       = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Attach tenant slug header to every request
  API.interceptors.request.use(async (config) => {
    try {
      const slug = await SecureStore.getItemAsync('tenant_slug');
      if (slug) config.headers['X-Tenant'] = slug;
    } catch {}
    return config;
  });

  useEffect(() => {
    checkToken();
  }, []);

  const checkToken = async () => {
    try {
      const token = await SecureStore.getItemAsync('auth_token');
      const slug  = await SecureStore.getItemAsync('tenant_slug');

      if (token && slug) {
        API.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        API.defaults.headers.common['X-Tenant']      = slug;
        const response = await API.get('/user');
        setUser(response.data);
        setTenant(slug);
      }
    } catch (error) {
      await SecureStore.deleteItemAsync('auth_token');
      await SecureStore.deleteItemAsync('tenant_slug');
      delete API.defaults.headers.common['Authorization'];
      delete API.defaults.headers.common['X-Tenant'];
    }
    setIsLoading(false);
  };

  const login = async (tenantSlug, email, password) => {
    // Set tenant header before login
    API.defaults.headers.common['X-Tenant'] = tenantSlug;

    const response = await API.post('/login', { email, password });
    const { token, user: userData } = response.data;

    await SecureStore.setItemAsync('auth_token', token);
    await SecureStore.setItemAsync('tenant_slug', tenantSlug);

    API.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(userData);
    setTenant(tenantSlug);
  };

  const register = async (tenantSlug, name, email, password) => {
    API.defaults.headers.common['X-Tenant'] = tenantSlug;
    const response = await API.post('/register', { name, email, password });
    return response.data;
  };

  



  const registerTenant = async (companyName, adminName, adminEmail, adminPassword) => {
    const response = await API.post('/tenants/register', {
      company_name:                companyName,
      admin_name:                  adminName,
      admin_email:                 adminEmail,
      admin_password:              adminPassword,
      admin_password_confirmation: adminPassword,
    });

    const { tenant: tenantData, token, admin } = response.data;

    await SecureStore.setItemAsync('auth_token', token);
    await SecureStore.setItemAsync('tenant_slug', tenantData.slug);

    API.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    API.defaults.headers.common['X-Tenant']      = tenantData.slug;

    setTenant(tenantData.slug);
    setUser(admin);          // ← this triggers automatic navigation

    return response.data;
  };




  const logout = async () => {
    try {
      await API.post('/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      await SecureStore.deleteItemAsync('auth_token');
      await SecureStore.deleteItemAsync('tenant_slug');
      delete API.defaults.headers.common['Authorization'];
      delete API.defaults.headers.common['X-Tenant'];
      setUser(null);
      setTenant(null);
    }
  };

  return (
    <AuthContext.Provider value={{
      user, tenant, isLoading,
      login, register, registerTenant, logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
};