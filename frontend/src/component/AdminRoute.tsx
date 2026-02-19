//在需要有管理员权限的页面中，加入此组件，防止普通用户越权访问
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

interface AdminRouteProps {
  children: React.ReactNode;
}

const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { auth } = useAuth();

  if (!auth.isLoggedIn || !auth.isAdmin) {
    alert("未登录或没有权限");
    return <Navigate to="/" />;
  }

  //是管理员，正常渲染组件
  return <>{children}</>;
};

export default AdminRoute;
