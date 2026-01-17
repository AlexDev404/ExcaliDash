import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import * as api from "../api";

type AuthState = {
  enabled: boolean;
  authenticated: boolean;
  user: { username: string } | null;
  loading: boolean;
  statusError: string | null;
};

type AuthContextValue = {
  state: AuthState;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshStatus: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    enabled: false,
    authenticated: false,
    user: null,
    loading: true,
    statusError: null,
  });

  const refreshStatus = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      loading: true,
    }));
    try {
      const status = await api.getAuthStatus();
      setState({
        enabled: status.enabled,
        authenticated: status.authenticated,
        user: status.user,
        loading: false,
        statusError: null,
      });
    } catch (error) {
      console.error("Failed to fetch auth status:", error);
      setState((prev) => ({
        ...prev,
        authenticated: false,
        user: null,
        loading: false,
        statusError: prev.statusError || "Unable to reach authentication service.",
      }));
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    api.setUnauthorizedHandler(() => {
      setState((prev) => ({
        ...prev,
        authenticated: false,
        user: null,
      }));
    });
    return () => api.setUnauthorizedHandler(null);
  }, []);

  const login = useCallback(
    async (username: string, password: string) => {
      await api.login(username, password);
      await refreshStatus();
    },
    [refreshStatus]
  );

  const logout = useCallback(async () => {
    await api.logout();
    await refreshStatus();
  }, [refreshStatus]);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      login,
      logout,
      refreshStatus,
    }),
    [state, login, logout, refreshStatus]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
