
import React, { useState } from 'react';
import { pb } from '../lib/pocketbase';
import { useAuthStore } from '../store/auth.store';
import { LogIn, Lock, Mail, Eye, EyeOff, Loader2, Sparkles, Rocket } from 'lucide-react';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(''); // Add error state for better UI feedback
  const setAuth = useAuthStore((state) => state.setAuth);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const authData = await pb.collection('users').authWithPassword(email, password);
      setAuth(authData.record as any);
    } catch (err: any) {
      // Intentar mostrar el mensaje de error de PocketBase si existe
      const message = err?.message || 'Error de conexión';
      setError(`Error: ${message}`);
      console.error("Login error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-950 via-slate-950 to-slate-950 p-4 text-slate-200 font-sans overflow-hidden">

      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[100px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[100px] animate-pulse delay-1000"></div>
      </div>

      <div className="relative w-full max-w-md z-10">

        {/* Glass Container */}
        <div className="backdrop-blur-xl bg-slate-900/40 border border-slate-700/50 shadow-2xl rounded-2xl overflow-hidden ring-1 ring-white/10">

          {/* Header Branding */}
          <div className="p-8 pb-6 text-center border-b border-white/5 bg-gradient-to-b from-white/5 to-transparent">
            <div className="inline-flex items-center justify-center p-3 mb-4 rounded-full bg-blue-500/10 ring-1 ring-blue-400/30 shadow-[0_0_15px_rgba(59,130,246,0.3)]">
              <Rocket className="w-8 h-8 text-blue-400" />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight mb-1">
              AstroPlay <span className="text-blue-400">OS</span>
            </h1>
            <p className="text-sm text-slate-400 font-medium tracking-wide uppercase">Sistema Operativo de Gestión</p>
          </div>

          <div className="p-8 pt-6">
            <form onSubmit={handleLogin} className="space-y-6">

              {/* Error Message */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-200 text-sm p-3 rounded-lg flex items-center justify-center animate-in fade-in slide-in-from-top-1">
                  {error}
                </div>
              )}

              {/* Email Input */}
              <div className="space-y-1 group">
                <label className="text-xs font-semibold text-slate-400 ml-1 uppercase tracking-wider">Correo Electrónico</label>
                <div className="relative transition-all duration-300 transform group-focus-within:scale-[1.01]">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                  </div>
                  <input
                    type="email"
                    required
                    className="block w-full pl-10 pr-3 py-3 border border-slate-700/50 rounded-xl leading-5 bg-slate-950/50 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 focus:bg-slate-900/80 transition-all duration-200 sm:text-sm shadow-inner"
                    placeholder="usuario@astroplay.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1 group">
                <label className="text-xs font-semibold text-slate-400 ml-1 uppercase tracking-wider">Contraseña</label>
                <div className="relative transition-all duration-300 transform group-focus-within:scale-[1.01]">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    className="block w-full pl-10 pr-10 py-3 border border-slate-700/50 rounded-xl leading-5 bg-slate-950/50 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 focus:bg-slate-900/80 transition-all duration-200 sm:text-sm shadow-inner"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 transition-colors focus:outline-none"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-lg shadow-blue-900/20 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:-translate-y-0.5"
              >
                {loading ? (
                  <Loader2 className="animate-spin h-5 w-5 text-white" />
                ) : (
                  <span className="flex items-center gap-2">
                    <LogIn className="w-5 h-5" /> Entrar al Sistema
                  </span>
                )}
              </button>
            </form>
          </div>

          {/* Footer */}
          <div className="px-8 py-4 bg-slate-950/30 border-t border-white/5 text-center flex justify-between items-center text-[10px] text-slate-500">
            <span>v1.0.0</span>
            <span className="flex items-center gap-1">
              Powered by <span className="font-semibold text-slate-400">Borde Studio</span> <Sparkles className="w-3 h-3 text-yellow-500/50" />
            </span>
          </div>

        </div>

        {/* Shadow reflection */}
        <div className="absolute -bottom-4 left-4 right-4 h-4 bg-black/40 blur-xl rounded-[100%]"></div>
      </div>
    </div>
  );
};