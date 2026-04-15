import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { LoginRequest } from '../types';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password } as LoginRequest),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      login(data.token, data.user);
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 sm:mt-20 p-6 sm:p-8 brutal-card animate-pop-in">
      <h1 className="text-3xl sm:text-4xl font-display font-black uppercase text-brutal-black mb-6 text-center shadow-[2px_2px_0_0_#FFD000]">
        Log In
      </h1>
      
      {error && (
        <div className="bg-brutal-red text-brutal-black font-bold p-3 border-2 border-brutal-black mb-6 shadow-[2px_2px_0_0_#1A1A1A]">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block font-black uppercase mb-2">Email</label>
          <input
            type="email"
            required
            className="brutal-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        
        <div>
          <label className="block font-black uppercase mb-2">Password</label>
          <input
            type="password"
            required
            className="brutal-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full text-xl uppercase tracking-widest mt-4"
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>

      <p className="mt-8 text-center font-bold">
        Don't have an account?{' '}
        <Link to="/signup" className="text-brutal-blue underline decoration-4 hover:text-brutal-pink">
          Sign up
        </Link>
      </p>
    </div>
  );
}
