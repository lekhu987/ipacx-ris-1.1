// src/App.js
import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "./components/Login/login";
import Dashboard from "./pages/Dashboard";
import Scheduling from "./pages/Scheduling";
import PACSpage from "./pages/PACSpage"; // Make sure the file exists as PACSpage.jsx
import AddPatient from "./pages/AddPatient";
import CreateReport from "./pages/CreateReport";
import ReportingPage from "./pages/ReportingPage";
import ReportPanelPage from "./pages/ReportPanel";
import MWLS from "./pages/MWLS";
import TemplateManagement from "./pages/adminsettings/TemplateManagement";
import UserManagement from "./pages/adminsettings/UserManagement";
import PacsManagement from "./pages/adminsettings/PacsManagement";
import PatientList from "./pages/PatientList";
import ProtectedRoute from "./components/ProtectedRoute";
import MainLayout from "./layout/MainLayout";
// Context
import { StudiesProvider } from "./context/StudiesContext";

function App() {
  return (
    <Router>
      <StudiesProvider>
        <Routes>
          {/* Public/Login route */}
          <Route path="/" element={<Login />} />

          {/* Protected routes */}
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/scheduling" element={<ProtectedRoute><Scheduling /></ProtectedRoute>} />
          <Route path="/pacspage" element={<ProtectedRoute><PACSpage /></ProtectedRoute>} /> {/* FIXED */}
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

          <Route path="/add-patient" element={<ProtectedRoute><AddPatient /></ProtectedRoute>} />
          <Route path="/create-report" element={<ProtectedRoute><CreateReport /></ProtectedRoute>} />
          <Route path="/reporting" element={<ProtectedRoute><ReportingPage /></ProtectedRoute>} />
          <Route path="/mwls" element={<ProtectedRoute><MWLS /></ProtectedRoute>} />
          <Route path="/report-panel" element={<ProtectedRoute><ReportPanelPage /></ProtectedRoute>} />

          {/* Admin routes */}
          <Route path="/admin/templates" element={<ProtectedRoute roles={['ADMIN']}><TemplateManagement /></ProtectedRoute>} />
          <Route path="/admin/user-management" element={<ProtectedRoute roles={['ADMIN']}><UserManagement /></ProtectedRoute>} />
          <Route path="/admin/pacs-management" element={<ProtectedRoute roles={['ADMIN']}><PacsManagement /></ProtectedRoute>} />

          {/* Redirect unknown routes */}
          <Route path="*" element={<Navigate to="/scheduling" replace />} />
        </Routes>
      </StudiesProvider>
    </Router>
  );
}

export default App;
