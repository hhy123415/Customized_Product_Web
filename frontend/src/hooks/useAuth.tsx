import { useContext } from "react";
import { AuthContext } from "../component/AuthContext";

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth必须在一个AuthProvider内使用");
  }
  return context;
};