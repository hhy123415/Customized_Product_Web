import { createContext } from "react";

export interface AuthState {
  isLoggedIn: boolean;
  user_id: string;
  username: string;
  role: string;
}

export interface AuthContextType {
  auth: AuthState;
  login: (user_id: string, username: string, role: string) => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);
