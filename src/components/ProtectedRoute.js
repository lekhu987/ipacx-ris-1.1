import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading...</div>; // show while restoring session

  if (!user) {
    return <Navigate to="/" replace />; // redirect if no session
  }

  return children; // render protected page if user exists
}
