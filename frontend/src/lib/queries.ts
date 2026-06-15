import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type {
  AuthResponse,
  Message,
  SessionDetail,
  SessionListItem,
  SessionStatusResponse,
} from "./types";
import { TERMINAL_STATUSES } from "./types";

export function useSessions() {
  return useQuery({
    queryKey: ["sessions"],
    queryFn: () => api<SessionListItem[]>("/sessions"),
  });
}

export function useSession(id: number, enabled = true) {
  return useQuery({
    queryKey: ["session", id],
    queryFn: () => api<SessionDetail>(`/sessions/${id}`),
    enabled,
  });
}

export function useSessionStatus(id: number, enabled: boolean) {
  return useQuery({
    queryKey: ["session-status", id],
    queryFn: () => api<SessionStatusResponse>(`/sessions/${id}/status`),
    enabled,
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      return s && !TERMINAL_STATUSES.includes(s) ? 2000 : false;
    },
  });
}

export function useMessages(id: number, enabled: boolean) {
  return useQuery({
    queryKey: ["messages", id],
    queryFn: () => api<Message[]>(`/sessions/${id}/messages`),
    enabled,
  });
}

export function useCreateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { company_name: string; website: string; objective: string }) =>
      api<{ id: number; status: string }>("/sessions", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sessions"] }),
  });
}

export function useRetrySession(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ id: number; status: string }>(`/sessions/${id}/retry`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["session", id] });
      qc.invalidateQueries({ queryKey: ["session-status", id] });
      qc.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
}

export function useSignup() {
  return useMutation({
    mutationFn: (body: { email: string; password: string }) =>
      api<AuthResponse>("/auth/signup", { method: "POST", body }),
  });
}

export function useLogin() {
  return useMutation({
    mutationFn: (body: { email: string; password: string }) =>
      api<AuthResponse>("/auth/login", { method: "POST", body }),
  });
}
