import { useState, useEffect, createContext, useContext, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";

const AUTH_TOKEN_KEY = "animestudioai_token";

export type User = {
  id: string;
  email: string;
  displayName: string | null;
  credits: number;
  isAdmin: boolean;
  roles: string[];
};

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  token: string | null;
  login: (data: any) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => void;
  api: (endpoint: string, options?: RequestInit) => Promise<Response>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(AUTH_TOKEN_KEY));
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const api = useCallback(
    async (endpoint: string, options: RequestInit = {}) => {
      const headers = new Headers(options.headers);
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
      if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
        headers.set("Content-Type", "application/json");
      }

      const res = await fetch(import.meta.env.BASE_URL + endpoint.replace(/^\//, ''), {
        ...options,
        headers,
      });

      if (res.status === 401) {
        setToken(null);
        localStorage.removeItem(AUTH_TOKEN_KEY);
        queryClient.setQueryData(["user"], null);
        setLocation("/login");
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || res.statusText || "API Error");
      }

      return res;
    },
    [token, queryClient, setLocation]
  );

  const { data: user, isLoading } = useQuery({
    queryKey: ["user"],
    queryFn: () => api("/api/auth/me").then((res) => res.json()),
    enabled: !!token,
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: (data: any) =>
      api("/api/auth/login", { method: "POST", body: JSON.stringify(data) }).then((res) => res.json()),
    onSuccess: (data) => {
      setToken(data.token);
      localStorage.setItem(AUTH_TOKEN_KEY, data.token);
      queryClient.setQueryData(["user"], data.user);
      setLocation("/app");
    },
  });

  const registerMutation = useMutation({
    mutationFn: (data: any) =>
      api("/api/auth/register", { method: "POST", body: JSON.stringify(data) }).then((res) => res.json()),
    onSuccess: (data) => {
      setToken(data.token);
      localStorage.setItem(AUTH_TOKEN_KEY, data.token);
      queryClient.setQueryData(["user"], data.user);
      setLocation("/app");
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => api("/api/auth/logout", { method: "POST" }).then((res) => res.json()).catch(() => {}),
    onSettled: () => {
      setToken(null);
      localStorage.removeItem(AUTH_TOKEN_KEY);
      queryClient.setQueryData(["user"], null);
      setLocation("/");
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user || null,
        isLoading,
        token,
        login: loginMutation.mutateAsync,
        register: registerMutation.mutateAsync,
        logout: logoutMutation.mutate,
        api,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
