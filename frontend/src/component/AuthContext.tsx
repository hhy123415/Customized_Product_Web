import { createContext } from "react";

export interface AuthState {
  isLoggedIn: boolean;
  user_id: string;
  username: string;
  isAdmin: boolean;
}

export interface AuthContextType {
  auth: AuthState;
  login: (user_id: string, username: string, isAdmin: boolean) => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);
