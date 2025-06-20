import { create } from "zustand";
import { persist } from "zustand/middleware";
import api from "../config";

interface User {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  role?: string;
  role_name?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  menu: any[];
  isAuthenticated: boolean;
  setAuth: (action: { type: string; payload: any }) => void;
  logout: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    first_name: string,
    last_name: string,
    role: string
  ) => Promise<void>;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: {
        id: 1,
        first_name: "Test",
        last_name: "User",
        email: "test@example.com",
        role_name: "admin",
      },
      token: "test-token",
      menu: [],
      isAuthenticated: true,
      setAuth: (action) => {
        switch (action.type) {
          case "LOGIN":
            set({
              user: action.payload.user,
              token: action.payload.token,
              isAuthenticated: true,
            });
            break;
          case "MENU":
            set({ menu: action.payload.menu });
            break;
          default:
            break;
        }
      },
      logout: () => {
        console.log("Logout called but ignored");
      },
      login: async (email, password) => {
        // Реальний запит до API
        const response = await api.post("/auth/login", { email, password });
        const { user, token } = response.data;
        set({
          user,
          token,
          isAuthenticated: true,
        });
        localStorage.setItem("token", token);
      },
      register: async (email, password, first_name, last_name, role) => {
        const response = await api.post("/auth/signup", {
          email,
          password,
          first_name,
          last_name,
          role,
        });
        return response.data;
      },
    }),
    {
      name: "auth-storage",
    }
  )
);
