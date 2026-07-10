import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import App from './App.jsx';
import AuthPage from './pages/AuthPage.jsx';
import Dashboard from './pages/Dashboard.jsx';
import CreateQuote from './pages/CreateQuote.jsx';
import CatalogPage from './pages/CatalogPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import ProposalPage from './pages/ProposalPage.jsx';
import ProposalFeedback from './pages/ProposalFeedback.jsx';
import ProposalAction from './pages/ProposalAction.jsx';
import './index.css';

/** Redirects unauthenticated visitors to /login. */
function PrivateRoute({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" replace />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
          {/* ── Standalone public pages (no sidebar) ── */}
          <Route path="/login" element={<AuthPage />} />
          <Route path="/proposal/:hash/feedback" element={<ProposalFeedback />} />
          <Route path="/proposal/:hash/:action"  element={<ProposalAction />} />
          <Route path="/proposal/:hash"          element={<ProposalPage />} />

          {/* ── Private app shell (sidebar + main area) ── */}
          <Route
            path="/"
            element={
              <PrivateRoute>
                <App />
              </PrivateRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard"    element={<Dashboard />} />
            <Route path="create-quote" element={<CreateQuote />} />
            <Route path="catalog"      element={<CatalogPage />} />
            <Route path="settings"     element={<SettingsPage />} />
          </Route>

          {/* ── Fallback ── */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
</AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);
