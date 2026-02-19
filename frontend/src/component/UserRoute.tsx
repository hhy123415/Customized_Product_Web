//需要登录访问
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

interface UserRouteProps {
  children: React.ReactNode;
}

const UserRoute: React.FC<UserRouteProps> = ({ children }) => {
  const { auth } = useAuth();

  if (!auth.isLoggedIn) {
    return <Navigate to="/" />;
  }

  return <>{children}</>;
};

export default UserRoute;
