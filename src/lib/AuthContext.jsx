import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';

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
        const appId = appParams.appId;
        if (!appId) { setIsLoadingPublicSettings(false); return; }
        const res = await fetch(`/api/apps/public/prod/public-settings/by-id/${appId}`, {
          headers: { 'X-App-Id': appId },
        });
        if (res.status === 403) {
          const data = await res.json().catch(() => ({}));
          if (data?.extra_data?.reason === 'user_not_registered') {
            setAuthError({ type: 'user_not_registered', message: 'User not registered' });
          }
        }
      } catch {
        // Сеть или config ошибка — не блокируем публичные страницы
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