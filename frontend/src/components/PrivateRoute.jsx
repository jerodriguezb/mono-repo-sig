// src/components/PrivateRoute.jsx
import React, { useContext } from "react";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext.jsx";

const PrivateRoute = ({ children }) => {
  const { token } = useContext(AuthContext) ?? {};
  return token ? children : <Navigate to="/login" replace />;
};

export default PrivateRoute;
