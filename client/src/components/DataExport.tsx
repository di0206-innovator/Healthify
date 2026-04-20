import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const API_BASE = '';

export default function DataExport() {
  const { token, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isAuthenticated) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20 animate-fade-in">
        <h1 className="text-4xl font-display font-black text-brutal-black uppercase mb-4">My Data</h1>
        <p className="text-lg font-bold text-brutal-black mb-6">You must be logged in to manage your data.</p>
        <button onClick={() => navigate('/login')} className="btn-primary">Log In</button>
      </div>
    );
  }

  const handleExport = async () => {
    setIsExporting(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE}/api/user/data-export`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to export data');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'healthify-my-data.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setMessage({ type: 'success', text: 'Your data has been downloaded!' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to export data. Please try again.' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleDelete = async () => {
    if (confirmText !== 'DELETE') return;

    setIsDeleting(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE}/api/user/account`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to delete account');

      logout();
      navigate('/');
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to delete account. Please try again.' });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-10 space-y-8 animate-fade-in">
      <div className="border-b-4 border-brutal-black pb-4">
        <h1 className="text-3xl sm:text-5xl font-display font-black text-brutal-black uppercase tracking-tight"
            style={{ textShadow: 'var(--brutal-shadow)' }}>
          My Data
        </h1>
        <p className="text-lg font-bold mt-2 text-brutal-black">Manage your personal data and account.</p>
      </div>

      {/* Status message */}
      {message && (
        <div className={`border-4 border-brutal-black rounded-xl px-5 py-4 font-bold text-lg shadow-brutal ${
          message.type === 'success' ? 'bg-brutal-green text-brutal-black' : 'bg-brutal-red text-brutal-black'
        }`}>
          {message.text}
        </div>
      )}

      {/* Data Export */}
      <div className="brutal-card bg-brutal-blue p-6 sm:p-8 space-y-4">
        <h2 className="text-2xl font-black uppercase text-brutal-black">📦 Export My Data</h2>
        <p className="font-bold text-brutal-black">
          Download all your personal data including your profile and scan history as a JSON file. 
          This complies with GDPR data portability rights.
        </p>
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="btn-primary w-full sm:w-auto text-lg uppercase tracking-wider flex items-center justify-center gap-3"
          id="export-data-button"
        >
          {isExporting ? (
            <>
              <div className="w-6 h-6 border-3 border-brutal-black border-dashed rounded-full animate-spin" />
              Exporting...
            </>
          ) : (
            <>⬇️ Download My Data</>
          )}
        </button>
      </div>

      {/* Danger Zone */}
      <div className="brutal-card bg-brutal-red p-6 sm:p-8 space-y-4">
        <h2 className="text-2xl font-black uppercase text-brutal-black">⚠️ Danger Zone</h2>
        <p className="font-bold text-brutal-black">
          Permanently delete your account and all associated data. This action <strong>cannot be undone</strong>.
        </p>

        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="btn-secondary bg-white w-full sm:w-auto text-lg uppercase tracking-wider"
            id="delete-account-trigger"
          >
            🗑️ Delete My Account
          </button>
        ) : (
          <div className="bg-white border-4 border-brutal-black rounded-xl p-4 space-y-4 shadow-brutal">
            <p className="font-black text-brutal-black uppercase">
              Type <span className="text-red-600">DELETE</span> to confirm:
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type DELETE here"
              className="brutal-input text-lg"
              id="delete-confirm-input"
            />
            <div className="flex gap-4">
              <button
                onClick={handleDelete}
                disabled={confirmText !== 'DELETE' || isDeleting}
                className={`btn-primary flex-1 text-lg uppercase ${
                  confirmText !== 'DELETE' ? 'opacity-50 cursor-not-allowed' : 'bg-brutal-red'
                }`}
                id="confirm-delete-button"
              >
                {isDeleting ? 'Deleting...' : '⚠️ Permanently Delete'}
              </button>
              <button
                onClick={() => { setShowDeleteConfirm(false); setConfirmText(''); }}
                className="btn-secondary flex-1 text-lg uppercase"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
