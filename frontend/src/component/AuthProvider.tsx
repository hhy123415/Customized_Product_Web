import React, { useState, useEffect, type ReactNode } from "react";
import {
  AuthContext,
  type AuthState,
  type AuthContextType,
} from "./AuthContext";
import api from "../api/axios";

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [auth, setAuth] = useState<AuthState>(() => {
    return {
      isLoggedIn: false,
      user_id: "",
      username: "",
      isAdmin: false,
    };
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 页面刷新时，从服务器确认身份
    const checkAuthStatus = async () => {
      try {
        const res = await api.get("/me");
        // console.log(res.data.user.user_id);
        if (res.data.success) {
          setAuth({
            isLoggedIn: true,
            user_id: res.data.user.user_id,
            username: res.data.user.username,
            isAdmin: res.data.user.isAdmin,
          });
        }
      } catch (err) {
        console.log(err);
        setAuth({
          isLoggedIn: false,
          user_id: "",
          username: "",
          isAdmin: false,
        });
      } finally {
        setLoading(false);
      }
    };
    checkAuthStatus();
  }, []);

  const login = (user_id: string, username: string, isAdmin: boolean) => {
    setAuth({ isLoggedIn: true, user_id, username, isAdmin });
  };

  const logout = async () => {
    try {
      await api.post("/logout");
    } finally {
      setAuth({
        isLoggedIn: false,
        user_id: "",
        username: "",
        isAdmin: false,
      });
    }
  };

  const value: AuthContextType = { auth, login, logout };

  // 如果还在加载中，显示一个加载指示器
  if (loading) {
    return <div>Loading authentication...</div>; // 或者一个更复杂的加载动画
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
