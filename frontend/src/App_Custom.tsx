import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { CustomAuthProvider } from './contexts/CustomAuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { CustomPasswordResetGuard } from './components/CustomPasswordResetGuard';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { ClientePage } from './pages/ClientePage';
import { ProcessoPage } from './pages/ProcessoPage';
import { AdminPage } from './pages/AdminPage';

function App() {
  return (
    <ThemeProvider>
      <CustomAuthProvider>
        <Router>
          <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
            <Routes>
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <CustomPasswordResetGuard>
                    <Layout>
                      <HomePage />
                    </Layout>
                  </CustomPasswordResetGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/home"
              element={
                <ProtectedRoute>
                  <CustomPasswordResetGuard>
                    <Layout>
                      <HomePage />
                    </Layout>
                  </CustomPasswordResetGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/cliente/:id"
              element={
                <ProtectedRoute>
                  <CustomPasswordResetGuard>
                    <Layout>
                      <ClientePage />
                    </Layout>
                  </CustomPasswordResetGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/cliente/:cliente_id/processo/:id"
              element={
                <ProtectedRoute>
                  <CustomPasswordResetGuard>
                    <Layout>
                      <ProcessoPage />
                    </Layout>
                  </CustomPasswordResetGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <CustomPasswordResetGuard>
                    <Layout>
                      <AdminPage />
                    </Layout>
                  </CustomPasswordResetGuard>
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
        </CustomAuthProvider>
      </ThemeProvider>
    );
  }

export default App;
