import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import AuthPage from "./pages/AuthPage";
import Quiz from "./pages/Quiz";
import Admin from "./pages/Admin";
import AdminLogin from "./pages/AdminLogin";

// Check authentication status
const isStudentAuthenticated = () => !!localStorage.getItem("student_token");
const isAdminAuthenticated = () => !!localStorage.getItem("adminToken");
const isAdmin = () => localStorage.getItem("role") === "admin";

// Protected routes
const AdminRoute = ({ children }) => {
  return isAdminAuthenticated() && isAdmin() ? (
    children
  ) : (
    <Navigate to="/admin/login" replace />
  );
};

const StudentRoute = ({ children }) => {
  return isStudentAuthenticated() ? children : <Navigate to="/" replace />;
};

const App = () => {
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<AuthPage />} />
        <Route path="/admin/login" element={<AdminLogin />} />

        {/* Protected Student Route */}
        <Route
          path="/student/quiz"
          element={
            <StudentRoute>
              <Quiz />
            </StudentRoute>
          }
        />

        {/* Protected Admin Route */}
        <Route
          path="/admin/dashboard"
          element={
            <AdminRoute>
              <Admin />
            </AdminRoute>
          }
        />

        {/* Redirect any other routes to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
};

export default App;
