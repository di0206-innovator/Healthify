import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import type { AdminStats, StoredScan, UserPublic } from '../types';

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export default function AdminPage() {
  const { token, isAdmin, isLoading } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [scans, setScans] = useState<StoredScan[]>([]);
  const [users, setUsers] = useState<UserPublic[]>([]);
  const [error, setError] = useState('');

  // Pagination state
  const [scanPage, setScanPage] = useState(1);
  const [userPage, setUserPage] = useState(1);
  const [scanPagination, setScanPagination] = useState<PaginationInfo | null>(null);
  const [userPagination, setUserPagination] = useState<PaginationInfo | null>(null);
  const ITEMS_PER_PAGE = 20;

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      navigate('/');
    }
  }, [isAdmin, isLoading, navigate]);

  // Fetch stats once
  useEffect(() => {
    if (!token || !isAdmin) return;
    const headers = { Authorization: `Bearer ${token}` };
    fetch('/api/admin/stats', { headers })
      .then((r) => r.json())
      .then(setStats)
      .catch(() => setError('Failed to load admin stats'));
  }, [token, isAdmin]);

  // Fetch scans with pagination
  useEffect(() => {
    if (!token || !isAdmin) return;
    const headers = { Authorization: `Bearer ${token}` };
    fetch(`/api/admin/scans?page=${scanPage}&limit=${ITEMS_PER_PAGE}`, { headers })
      .then((r) => r.json())
      .then((data) => {
        setScans(data.data || data.scans || []);
        setScanPagination(data.pagination || null);
      })
      .catch(() => setError('Failed to load scans'));
  }, [token, isAdmin, scanPage]);

  // Fetch users with pagination
  useEffect(() => {
    if (!token || !isAdmin) return;
    const headers = { Authorization: `Bearer ${token}` };
    fetch(`/api/admin/users?page=${userPage}&limit=${ITEMS_PER_PAGE}`, { headers })
      .then((r) => r.json())
      .then((data) => {
        setUsers(data.data || data.users || []);
        setUserPagination(data.pagination || null);
      })
      .catch(() => setError('Failed to load users'));
  }, [token, isAdmin, userPage]);

  if (isLoading || !isAdmin) return <div className="text-center mt-20 font-black text-2xl">Loading Admin...</div>;

  return (
    <div className="max-w-6xl mx-auto py-10 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 border-b-4 border-brutal-black pb-4 gap-4">
        <h1 className="text-3xl sm:text-5xl font-display font-black text-brutal-black uppercase tracking-tight shadow-[4px_4px_0_0_#A663CC]">
          Admin Dashboard
        </h1>
        <Link to="/" className="btn-secondary">Back to Scanner</Link>
      </div>

      {error ? (
        <div className="bg-brutal-red text-white p-4 font-bold border-4 border-brutal-black mb-6">
          {error}
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
              <div className="brutal-card bg-brutal-yellow p-6 flex flex-col justify-center items-center">
                <h3 className="text-xl font-black uppercase text-brutal-black">Total Users</h3>
                <p className="text-4xl sm:text-6xl font-display font-black mt-2 drop-shadow-[2px_2px_0_#fff]">{stats.totalUsers}</p>
              </div>
              <div className="brutal-card bg-brutal-green p-6 flex flex-col justify-center items-center">
                <h3 className="text-xl font-black uppercase text-brutal-black">Total Scans</h3>
                <p className="text-4xl sm:text-6xl font-display font-black mt-2 drop-shadow-[2px_2px_0_#fff]">{stats.totalScans}</p>
              </div>
              <div className="brutal-card bg-brutal-pink p-6 flex flex-col justify-center items-center">
                <h3 className="text-xl font-black uppercase text-brutal-black">Avg Score</h3>
                <p className="text-4xl sm:text-6xl font-display font-black mt-2 drop-shadow-[2px_2px_0_#fff]">{stats.avgScore}</p>
              </div>
            </div>
          )}

          {/* Recent Scans Table */}
          <div className="brutal-card bg-white p-0 overflow-hidden mb-12">
            <div className="bg-brutal-black text-white p-4 flex justify-between items-center">
              <h2 className="text-2xl font-black uppercase">Recent Scans</h2>
              {scanPagination && (
                <span className="text-sm font-bold text-gray-300">
                  {scanPagination.total} total • Page {scanPagination.page}/{scanPagination.pages}
                </span>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left font-bold border-collapse">
                <thead>
                  <tr className="border-b-4 border-brutal-black bg-[#E0E0E0]">
                    <th className="p-4 uppercase">User</th>
                    <th className="p-4 uppercase">Score</th>
                    <th className="p-4 uppercase">Grade</th>
                    <th className="p-4 uppercase">Country</th>
                    <th className="p-4 uppercase">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {scans.map((scan) => (
                    <tr key={scan.id} className="border-b-2 border-brutal-black hover:bg-[#FDFBF7]">
                      <td className="p-4 truncate max-w-[200px]">{scan.userName}</td>
                      <td className="p-4">{scan.report.safetyScore}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 border-2 border-brutal-black 
                          ${scan.report.grade === 'A' ? 'bg-brutal-green' : scan.report.grade === 'F' ? 'bg-brutal-red text-white' : 'bg-brutal-yellow'}
                        `}>
                          {scan.report.grade}
                        </span>
                      </td>
                      <td className="p-4">{scan.report.country}</td>
                      <td className="p-4 text-sm">{new Date(scan.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                  {scans.length === 0 && (
                     <tr><td colSpan={5} className="p-8 text-center text-gray-500">No scans recorded yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {/* Pagination Controls */}
            {scanPagination && scanPagination.pages > 1 && (
              <div className="flex items-center justify-between border-t-4 border-brutal-black p-4 bg-[#F5F5F5]">
                <button
                  onClick={() => setScanPage((p) => Math.max(1, p - 1))}
                  disabled={scanPage <= 1}
                  className="btn-secondary text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ← Previous
                </button>
                <span className="font-black text-brutal-black uppercase text-sm tracking-wider">
                  Page {scanPagination.page} of {scanPagination.pages}
                </span>
                <button
                  onClick={() => setScanPage((p) => Math.min(scanPagination.pages, p + 1))}
                  disabled={scanPage >= scanPagination.pages}
                  className="btn-secondary text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next →
                </button>
              </div>
            )}
          </div>

          {/* Users List */}
          <div className="brutal-card bg-white p-0 overflow-hidden">
            <div className="bg-brutal-blue text-white p-4 border-b-4 border-brutal-black flex justify-between items-center">
              <h2 className="text-2xl font-black uppercase text-brutal-black drop-shadow-[1px_1px_0_#fff]">Registered Users</h2>
              {userPagination && (
                <span className="text-sm font-bold text-brutal-black">
                  {userPagination.total} total • Page {userPagination.page}/{userPagination.pages}
                </span>
              )}
            </div>
            <div className="overflow-x-auto">
            <table className="w-full text-left font-bold border-collapse min-w-[500px]">
                <thead>
                  <tr className="border-b-4 border-brutal-black bg-[#E0E0E0]">
                    <th className="p-4 uppercase">Name</th>
                    <th className="p-4 uppercase">Email</th>
                    <th className="p-4 uppercase">Role</th>
                    <th className="p-4 uppercase">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b-2 border-brutal-black hover:bg-[#FDFBF7]">
                      <td className="p-4">{user.name}</td>
                      <td className="p-4">{user.email}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 border-2 border-brutal-black ${user.role === 'admin' ? 'bg-brutal-purple text-white' : 'bg-white'}`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="p-4 text-sm">{new Date(user.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Pagination Controls */}
            {userPagination && userPagination.pages > 1 && (
              <div className="flex items-center justify-between border-t-4 border-brutal-black p-4 bg-[#F5F5F5]">
                <button
                  onClick={() => setUserPage((p) => Math.max(1, p - 1))}
                  disabled={userPage <= 1}
                  className="btn-secondary text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ← Previous
                </button>
                <span className="font-black text-brutal-black uppercase text-sm tracking-wider">
                  Page {userPagination.page} of {userPagination.pages}
                </span>
                <button
                  onClick={() => setUserPage((p) => Math.min(userPagination.pages, p + 1))}
                  disabled={userPage >= userPagination.pages}
                  className="btn-secondary text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
