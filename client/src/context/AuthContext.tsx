import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import type { User, AuthState } from '../types';

interface AuthContextType extends AuthState {
  login: (token: string, user: User, refreshToken?: string) => void;
  logout: () => void;
  getValidToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getInitialState(): AuthState {
  const storedToken = localStorage.getItem('token');
  const storedUser = localStorage.getItem('user');

  if (storedToken && storedUser) {
    try {
      const user = JSON.parse(storedUser) as User;
      return {
        user,
        token: storedToken,
        isAuthenticated: true,
        isAdmin: user.role === 'admin',
        isLoading: false,
      };
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('refreshToken');
    }
  }

  return {
    user: null,
    token: null,
    isAuthenticated: false,
    isAdmin: false,
    isLoading: false,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(getInitialState);
  const refreshingRef = useRef<Promise<string | null> | null>(null);

  const login = useCallback((token: string, user: User, refreshToken?: string) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    if (refreshToken) {
      localStorage.setItem('refreshToken', refreshToken);
    }
    setState({
      user,
      token,
      isAuthenticated: true,
      isAdmin: user.role === 'admin',
      isLoading: false,
    });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('refreshToken');
    setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isAdmin: false,
      isLoading: false,
    });
  }, []);

  /**
   * Auto-refresh: attempt to get a valid token.
   * If the current token appears expired, uses the refresh token to get a new one.
   * Deduplicates concurrent refresh attempts.
   */
  const getValidToken = useCallback(async (): Promise<string | null> => {
    const currentToken = localStorage.getItem('token');
    if (!currentToken) return null;

    // Quick check: decode JWT payload to see if it's expired
    try {
      const payloadBase64 = currentToken.split('.')[1];
      const payload = JSON.parse(atob(payloadBase64));
      const now = Math.floor(Date.now() / 1000);

      // If token has >60s left, it's still valid
      if (payload.exp && payload.exp > now + 60) {
        return currentToken;
      }
    } catch {
      // If we can't decode, try to use it anyway
      return currentToken;
    }

    // Token is expired or almost expired — try to refresh
    const storedRefreshToken = localStorage.getItem('refreshToken');
    if (!storedRefreshToken) {
      logout();
      return null;
    }

    // Deduplicate concurrent refresh calls
    if (refreshingRef.current) {
      return refreshingRef.current;
    }

    refreshingRef.current = (async () => {
      try {
        const res = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: storedRefreshToken }),
        });

        if (!res.ok) {
          logout();
          return null;
        }

        const data = await res.json();
        localStorage.setItem('token', data.token);

        setState((prev) => ({
          ...prev,
          token: data.token,
        }));

        return data.token as string;
      } catch {
        logout();
        return null;
      } finally {
        refreshingRef.current = null;
      }
    })();

    return refreshingRef.current;
  }, [logout]);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, getValidToken }}>
      {children}
    </AuthContext.Provider>
  );
}

// Exported separately so react-refresh can detect only component exports
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
