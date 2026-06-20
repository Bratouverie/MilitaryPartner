import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';
import { createAxiosClient } from '@base44/sdk/dist/utils/axios-client';

const AuthContext = createContext();

/**
 * AuthProvider — используется ТОЛЬКО для определения владельца приложения (owner/bootstrap).
 * НЕ блокирует публичные страницы. НЕ является основной auth-моделью.
 * Основная auth-модель — secret code flow + sessionStorage (profileSession.js).
 */
export const AuthProvider = ({ children }) => {
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    const checkAppState = async () => {
      try {
        const appClient = createAxiosClient({
          baseURL: `/api/apps/public`,
          headers: { 'X-App-Id': appParams.appId },
          token: appParams.token,
          interceptResponses: true,
        });
        await appClient.get(`/prod/public-settings/by-id/${appParams.appId}`);
      } catch (appError) {
        if (appError.status === 403 && appError.data?.extra_data?.reason === 'user_not_registered') {
          setAuthError({ type: 'user_not_registered', message: 'User not registered' });
        }
        // auth_required и unknown — не блокируем, публичные страницы работают
      } finally {
        setIsLoadingPublicSettings(false);
      }
    };
    checkAppState();
  }, []);

  return (
    <AuthContext.Provider value={{ isLoadingPublicSettings, authError }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};