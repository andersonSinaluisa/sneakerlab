import { create } from "zustand";
import { ApiError, authApi, getToken, setToken, type ApiUser } from "./client";

interface AuthState {
  user: ApiUser | null;
  /** idle = aún no comprobado; ready = comprobado (con o sin sesión); offline = API inaccesible */
  status: "idle" | "loading" | "ready" | "offline";
  hydrate: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  status: "idle",
  async hydrate() {
    if (get().status !== "idle") return;
    set({ status: "loading" });
    if (!getToken()) return set({ status: "ready" });
    try {
      const { user } = await authApi.me();
      set({ user, status: "ready" });
    } catch (e) {
      if (e instanceof ApiError) { setToken(null); set({ user: null, status: "ready" }); }
      else set({ status: "offline" });
    }
  },
  async login(email, password) {
    const { user, token } = await authApi.login({ email, password });
    setToken(token);
    set({ user, status: "ready" });
  },
  async register(name, email, password) {
    const { user, token } = await authApi.register({ name, email, password });
    setToken(token);
    set({ user, status: "ready" });
  },
  logout() {
    setToken(null);
    set({ user: null, status: "ready" });
  },
}));

export const useUser = () => useAuth((s) => s.user);
export const useIsAdminRole = () => useAuth((s) => s.user?.role === "admin");
