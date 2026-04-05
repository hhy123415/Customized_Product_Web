import { createContext } from "react";

export interface AuthState {
  isLoggedIn: boolean;
  user_id: string;
  username: string;
  role: string;
  img_path: string | null;
}

export interface AuthContextType {
  auth: AuthState;
  login: (
    user_id: string,
    username: string,
    role: string,
    img_path?: string | null,
  ) => void;
  updateAvatar: (img_path: string | null) => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);
