import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";

// Pages & Components
import Login from "./components/Login/login";
import Dashboard from "./pages/Dashboard";
import Scheduling from "./pages/Scheduling";
import PACSpage from "./pages/PACSpage";
import AddPatient from "./pages/AddPatient";
import CreateReport from "./pages/CreateReport";
import ReportingPage from "./pages/ReportingPage";
import ReportPanelPage from "./pages/ReportPanel";
import MWLS from "./pages/MWLS";
import TemplateManagement from "./pages/adminsettings/TemplateManagement";
import UserManagement from "./pages/adminsettings/UserManagement";
import PacsManagement from "./pages/adminsettings/PacsManagement";
import MwlsManagement from "./pages/adminsettings/MwlsManagement";
import PatientList from "./pages/PatientList";
import Billing from "./pages/Billing";
import ProtectedRoute from "./components/ProtectedRoute";
import MainLayout from "./layout/MainLayout";
import AddNewReportPage from "./pages/AddNewReportPage";
import ReportedBy from "./pages/adminsettings/ReportedBy";
import AuditLogs from "./pages/adminsettings/AuditLogs";


// Context
import { StudiesProvider } from "./context/StudiesContext";
import { PatientProvider } from "./context/PatientContext";
import { useAuth } from "./context/AuthContext";

function App() {
  const { user } = useAuth();

  return (
    <Router>
      <Toaster position="top-right" />
      <PatientProvider>
        <StudiesProvider>
          <Routes>
            {/* Public/Login route */}
            <Route path="/" element={<Login />} />

            {/* Protected routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/scheduling"
              element={
                <ProtectedRoute>
                  <Scheduling />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pacspage"
              element={
                <ProtectedRoute>
                  <PACSpage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/patient-list"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <PatientList />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/billing"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <Billing />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/add-patient"
              element={
                <ProtectedRoute>
                  <AddPatient />
                </ProtectedRoute>
              }
            />
            <Route
              path="/create-report"
              element={
                <ProtectedRoute>
                  <CreateReport />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reporting"
              element={
                <ProtectedRoute>
                  <ReportingPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/mwls"
              element={
                <ProtectedRoute>
                  <MWLS />
                </ProtectedRoute>
              }
            />
            <Route
              path="/report-panel"
              element={
                <ProtectedRoute>
                  <ReportPanelPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/secure-report-sheet"
              element={<ReportPanelPage />}
            />
<Route
  path="/add-new-report"
  element={
    <ProtectedRoute>
      <AddNewReportPage />
    </ProtectedRoute>
  }
/>
            {/* Admin routes */}
            <Route
              path="/admin/templates"
              element={
                <ProtectedRoute roles={["ADMIN"]}>
                  <TemplateManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/user-management"
              element={
                <ProtectedRoute roles={["ADMIN"]}>
                  <UserManagement />
                </ProtectedRoute>
              }
            />
            <Route
  path="/admin/reportedby"
  element={
    <ProtectedRoute roles={["ADMIN"]}>
      <ReportedBy />
    </ProtectedRoute>
  }
/>

            <Route
              path="/admin/pacs-management"
              element={
                <ProtectedRoute roles={["ADMIN"]}>
                  <PacsManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/mwls-management"
              element={
                <ProtectedRoute roles={["ADMIN"]}>
                  <MwlsManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/audit-logs"
              element={
                <ProtectedRoute roles={["ADMIN"]}>
                  <AuditLogs />
                </ProtectedRoute>
              }
            />

            {/* Redirect unknown routes */}
            <Route path="*" element={<Navigate to={user ? "/dashboard" : "/"} replace />} />
          </Routes>
        </StudiesProvider>
      </PatientProvider>
    </Router>
  );
}

export default App;
