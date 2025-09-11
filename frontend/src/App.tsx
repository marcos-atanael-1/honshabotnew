
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PasswordResetGuard } from './components/PasswordResetGuard';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { ClientePage } from './pages/ClientePage';
import { ProcessoPage } from './pages/ProcessoPage';
import { AdminPage } from './pages/AdminPage';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
            <Routes>
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <PasswordResetGuard>
                    <Layout>
                      <HomePage />
                    </Layout>
                  </PasswordResetGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/home"
              element={
                <ProtectedRoute>
                  <PasswordResetGuard>
                    <Layout>
                      <HomePage />
                    </Layout>
                  </PasswordResetGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/cliente/:id"
              element={
                <ProtectedRoute>
                  <PasswordResetGuard>
                    <Layout>
                      <ClientePage />
                    </Layout>
                  </PasswordResetGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/cliente/:cliente_id/processo/:id"
              element={
                <ProtectedRoute>
                  <PasswordResetGuard>
                    <Layout>
                      <ProcessoPage />
                    </Layout>
                  </PasswordResetGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <PasswordResetGuard>
                    <Layout>
                      <AdminPage />
                    </Layout>
                  </PasswordResetGuard>
                </ProtectedRoute>
              }
            />
          </Routes>
        </div>
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
            success: {
              duration: 3000,
              style: {
                background: '#10B981',
              },
            },
            error: {
              duration: 5000,
              style: {
                background: '#EF4444',
              },
            },
          }}
        />
          </Router>
        </AuthProvider>
      </ThemeProvider>
    );
  }

export default App;