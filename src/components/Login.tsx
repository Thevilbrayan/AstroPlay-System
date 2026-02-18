import React, { useState } from 'react';
import { pb } from '../lib/pocketbase';
import { useAuthStore } from '../store/auth.store';
import { LogIn, Lock, Mail } from 'lucide-react';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((state) => state.setAuth);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const authData = await pb.collection('users').authWithPassword(email, password);
      // Guardamos al usuario con su rol (admin/operator)
      setAuth(authData.record as any);
    } catch (error) {
      alert('Credenciales incorrectas o error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-gray-100">
      <form onSubmit={handleLogin} className="w-96 rounded-lg bg-white p-8 shadow-xl">
        <h2 className="mb-6 text-center text-2xl font-bold text-gray-800">AstroPlay OS</h2>
        <div className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-3 top-3 text-gray-400" size={20} />
            <input 
              type="email" placeholder="Email" required
              className="w-full rounded border p-2 pl-10 outline-none focus:border-blue-500"
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-3 text-gray-400" size={20} />
            <input 
              type="password" placeholder="Contraseña" required
              className="w-full rounded border p-2 pl-10 outline-none focus:border-blue-500"
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button 
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded bg-blue-600 p-2 text-white hover:bg-blue-700 disabled:bg-blue-300"
          >
            {loading ? 'Cargando...' : <><LogIn size={20} /> Entrar</>}
          </button>
        </div>
      </form>
    </div>
  );
};