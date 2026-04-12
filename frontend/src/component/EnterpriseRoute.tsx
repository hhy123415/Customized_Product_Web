import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

interface EnterpriseRouteProps {
  children: React.ReactNode;
}

const EnterpriseRoute: React.FC<EnterpriseRouteProps> = ({ children }) => {
  const { auth } = useAuth();

  if (!auth.isLoggedIn || auth.role !== "enterprise") {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default EnterpriseRoute;
