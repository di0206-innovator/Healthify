import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import ReportCard from './ReportCard';
import type { StoredScan } from '../types';

export default function ScanHistory() {
  const { token, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  const [scans, setScans] = useState<StoredScan[]>([]);
  const [error, setError] = useState('');
  const [loadingScans, setLoadingScans] = useState(true);
  const [selectedScan, setSelectedScan] = useState<StoredScan | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, isLoading, navigate]);

  useEffect(() => {
    if (!token) return;

    const fetchHistory = async () => {
      try {
        const res = await fetch('/api/scans/history', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to load history');
        
        const data = await res.json();
        setScans(data.scans);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoadingScans(false);
      }
    };

    fetchHistory();
  }, [token]);

  if (isLoading || loadingScans) return <div className="text-center mt-20 font-black text-2xl animate-pulse">Loading History...</div>;

  if (selectedScan) {
    return (
      <div className="max-w-5xl mx-auto pt-6 animate-fade-in relative">
        <button 
          onClick={() => setSelectedScan(null)}
          className="absolute -top-4 left-0 sm:left-6 z-10 btn-secondary flex items-center gap-2 py-2 px-4 shadow-[2px_2px_0_0_#1A1A1A]"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to History
        </button>
        <div className="mt-12 sm:mt-8">
           <ReportCard report={selectedScan.report} onScanAgain={() => navigate('/')} />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-10 px-4 sm:px-6 animate-pop-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 border-b-4 border-brutal-black pb-4 gap-4">
        <h1 className="text-3xl sm:text-5xl font-display font-black text-brutal-black uppercase tracking-tight shadow-[4px_4px_0_0_#32E0C4] inline-block bg-white px-2">
          Your Scan History
        </h1>
        <Link to="/" className="btn-primary py-3">New Scan</Link>
      </div>

      {error ? (
        <div className="bg-brutal-red text-white p-4 font-bold border-4 border-brutal-black mb-6">
          {error}
        </div>
      ) : scans.length === 0 ? (
        <div className="brutal-card p-12 text-center bg-[#E0E0E0]">
          <h2 className="text-3xl font-black text-brutal-black uppercase bg-white inline-block px-4 py-2 border-4 border-brutal-black shadow-[4px_4px_0_0_#1A1A1A] -rotate-2">
            No Scans Yet!
          </h2>
          <p className="mt-6 text-xl font-bold">Go scan some ingredients to build your history.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {scans.map((scan) => (
            <div 
              key={scan.id} 
              className="brutal-card-hover bg-white p-6 cursor-pointer flex flex-col outline-none focus:ring-4 focus:ring-brutal-blue"
              onClick={() => setSelectedScan(scan)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if(e.key === 'Enter') setSelectedScan(scan); }}
            >
              <div className="flex justify-between items-start mb-4">
                <span className={`text-2xl font-black px-3 py-1 border-4 border-brutal-black shadow-[2px_2px_0_0_#1A1A1A]
                  ${scan.report.grade === 'A' ? 'bg-brutal-green' : scan.report.grade === 'F' ? 'bg-brutal-red text-white' : 'bg-brutal-yellow'}
                `}>
                  {scan.report.grade}
                </span>
                <span className="text-xs font-bold bg-[#E0E0E0] border-2 border-brutal-black px-2 py-1 uppercase">
                  {new Date(scan.createdAt).toLocaleDateString()}
                </span>
              </div>
              
              <div className="mb-4">
                <p className="text-3xl font-display font-black line-clamp-2">Score: {scan.report.safetyScore}</p>
                <p className="text-sm font-bold mt-2">
                  <span className="bg-brutal-red text-white px-1 border border-brutal-black mr-1">{scan.report.harmfulCount}</span>
                  flagged / {scan.report.totalCount} total
                </p>
              </div>

              <div className="mt-auto pt-4 border-t-4 border-brutal-black flex justify-between items-center text-sm font-black uppercase">
                <span>{scan.report.country}</span>
                <span className="text-brutal-blue hover:text-brutal-pink">View Report →</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
