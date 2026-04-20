import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { SignupRequest } from '../types';

export default function SignupPage() {
  const [name, setName] = useState('');
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
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password } as SignupRequest),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Signup failed');
      }

      login(data.token, data.user, data.refreshToken);
      navigate('/');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Signup failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 sm:mt-20 p-6 sm:p-8 brutal-card animate-pop-in">
      <h1 className="text-3xl sm:text-4xl font-display font-black uppercase text-brutal-black mb-6 text-center shadow-[2px_2px_0_0_#32E0C4]">
        Sign Up
      </h1>
      
      {error && (
        <div className="bg-brutal-red text-brutal-black font-bold p-3 border-2 border-brutal-black mb-6 shadow-[2px_2px_0_0_#1A1A1A]">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block font-black uppercase mb-2">Full Name</label>
          <input
            type="text"
            required
            className="brutal-input bg-brutal-pink/10"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div>
          <label className="block font-black uppercase mb-2">Email</label>
          <input
            type="email"
            required
            className="brutal-input bg-brutal-blue/10"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        
        <div>
          <label className="block font-black uppercase mb-2">Password</label>
          <input
            type="password"
            required
            className="brutal-input bg-brutal-yellow/10"
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="text-xs font-bold text-gray-500 mt-2">Must be at least 6 characters</p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full text-xl uppercase tracking-widest mt-4 bg-brutal-green hover:bg-brutal-blue"
        >
          {loading ? 'Creating Account...' : 'Create Account'}
        </button>
      </form>

      <p className="mt-8 text-center font-bold">
        Already have an account?{' '}
        <Link to="/login" className="text-brutal-blue underline decoration-4 hover:text-brutal-pink">
          Log in
        </Link>
      </p>
    </div>
  );
}
