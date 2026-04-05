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
      role: "regular",
      img_path: null,
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
            role: res.data.user.role,
            img_path: res.data.user.img_path ?? null,
          });
        }
      } catch (err) {
        console.log(err);
        setAuth({
          isLoggedIn: false,
          user_id: "",
          username: "",
          role: "regular",
          img_path: null,
        });
      } finally {
        setLoading(false);
      }
    };
    checkAuthStatus();
  }, []);

  const login = (
    user_id: string,
    username: string,
    role: string,
    img_path: string | null = null,
  ) => {
    setAuth({ isLoggedIn: true, user_id, username, role, img_path });
  };

  const updateAvatar = (img_path: string | null) => {
    setAuth((prev) => ({ ...prev, img_path }));
  };

  const logout = async () => {
    try {
      await api.post("/logout");
    } finally {
      setAuth({
        isLoggedIn: false,
        user_id: "",
        username: "",
        role: "regular",
        img_path: null,
      });
    }
  };

  const value: AuthContextType = { auth, login, updateAvatar, logout };

  // 如果还在加载中，显示一个加载指示器
  if (loading) {
    return <div>Loading authentication...</div>; // 或者一个更复杂的加载动画
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
