import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './components/Home';
import LoginPage from './components/LoginPage';
import SignupPage from './components/SignupPage';
import AdminPage from './components/AdminPage';
import ScanHistory from './components/ScanHistory';
import DataExport from './components/DataExport';

export default function App() {
  return (
    <div className="min-h-screen relative overflow-x-hidden flex flex-col">
      <Navbar />

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-16 w-full flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/history" element={<ScanHistory />} />
          <Route path="/my-data" element={<DataExport />} />
        </Routes>
      </main>

      {/* Footer */}
      <footer className="border-t-4 border-brutal-black bg-white mt-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 font-bold uppercase tracking-wider">
          <p className="text-xs text-brutal-black">
            © {new Date().getFullYear()} Healthify
          </p>
          <p className="text-[10px] text-brutal-black bg-brutal-yellow px-3 py-1 border-2 border-brutal-black rounded-md shadow-[1px_1px_0_0_#1A1A1A]">
            AI-POWERED • NOT MEDICAL ADVICE
          </p>
        </div>
      </footer>
    </div>
  );
}
