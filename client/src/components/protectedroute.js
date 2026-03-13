import React from "react";
import { Navigate } from "react-router-dom";
import { useMsal } from "@azure/msal-react";

// Import group IDs from your constants
import { EMPLOYEE_GROUP, SECURITY_GROUP } from "../constants/groups";

export default function ProtectedRoute({ children, allowedGroups }) {
  const { accounts } = useMsal();

  // ❌ Not logged in
  if (!accounts || accounts.length === 0) {
    // Redirect based on allowedGroups
    console.log(EMPLOYEE_GROUP, SECURITY_GROUP);
    if (allowedGroups.includes(EMPLOYEE_GROUP)) {
      return <Navigate to="/employee" replace />;
    } else if (allowedGroups.includes(SECURITY_GROUP)) {
      return <Navigate to="/security" replace />;
    } else {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  // Get user's groups from idTokenClaims
  const userGroups = accounts[0]?.idTokenClaims?.groups || [];

  // ❌ Logged in but not authorized
  const hasAccess = allowedGroups.some(group => userGroups.includes(group));

  if (!hasAccess) {
    return <Navigate to="/unauthorized" replace />;
  }

  // ✅ Authorized
  return children;
}
