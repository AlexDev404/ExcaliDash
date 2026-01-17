import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { Editor } from './pages/Editor';
import { Settings } from './pages/Settings';
import { ThemeProvider } from './context/ThemeContext';
import { UploadProvider } from './context/UploadContext';
import { AuthProvider } from './context/AuthContext';
import { AuthGate } from './components/AuthGate';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <UploadProvider>
          <Router>
            <AuthGate>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/collections" element={<Dashboard />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/editor/:id" element={<Editor />} />
              </Routes>
            </AuthGate>
          </Router>
        </UploadProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
