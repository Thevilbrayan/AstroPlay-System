
import React, { useState } from 'react';
import { pb } from '../lib/pocketbase';
import { useAuthStore } from '../store/auth.store';
import { useWorkstationStore } from '../store/workstation.store';
import { LogIn, Lock, Mail, Eye, EyeOff, Loader2, Sparkles, Rocket, Monitor } from 'lucide-react';
import { TitleBar } from './layout/TitleBar';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(''); // Add error state for better UI feedback
  const setAuth = useAuthStore((state) => state.setAuth);
  const { workstationName } = useWorkstationStore();

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
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 font-sans overflow-hidden pt-9">
      <TitleBar />

      {/* Decorative Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/20 dark:bg-blue-600/10 rounded-full blur-[100px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/20 dark:bg-indigo-600/10 rounded-full blur-[100px] animate-pulse delay-1000"></div>
      </div>

      <div className="relative w-full max-w-md z-10">

        {/* Card Container */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 shadow-xl dark:shadow-2xl dark:shadow-blue-900/10 rounded-2xl overflow-hidden">

          {/* Header Branding */}
          <div className="p-8 pb-6 text-center border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-slate-800/20">
            <div className="inline-flex items-center justify-center p-3 mb-4 rounded-xl bg-blue-100 dark:bg-blue-500/10 ring-1 ring-blue-200 dark:ring-blue-400/30 shadow-inner">
              <Rocket className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 tracking-tight mb-1">
              AstroPlay <span className="text-blue-600 dark:text-blue-400">OS</span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium tracking-wide uppercase mb-4">Sistema Operativo de Gestión</p>

            {/* Lock Screen Workstation Context Info */}
            {workstationName && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-slate-800/80 rounded-full border border-emerald-200 dark:border-slate-700/50">
                <Monitor className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-semibold text-emerald-800 dark:text-slate-300">
                  Estación: <span className="text-emerald-600 dark:text-emerald-400 font-bold">{workstationName}</span>
                </span>
              </div>
            )}
          </div>

          <div className="p-8 pt-4">
            <form onSubmit={handleLogin} className="space-y-6">

              {/* Error Message */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-200 text-sm p-3 rounded-lg flex items-center justify-center animate-in fade-in slide-in-from-top-1">
                  {error}
                </div>
              )}

              {/* Email Input */}
              <div className="space-y-1.5 group">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-1 uppercase tracking-wider">Correo Electrónico</label>
                <div className="relative transition-all duration-300">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                  </div>
                  <input
                    type="email"
                    required
                    className="block w-full pl-11 pr-4 py-3 border border-slate-200 dark:border-slate-700/50 rounded-xl leading-5 bg-slate-50 dark:bg-slate-950/50 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900/80 transition-all font-medium sm:text-sm"
                    placeholder="usuario@astroplay.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5 group">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-1 uppercase tracking-wider">Contraseña</label>
                <div className="relative transition-all duration-300">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    className="block w-full pl-11 pr-11 py-3 border border-slate-200 dark:border-slate-700/50 rounded-xl leading-5 bg-slate-50 dark:bg-slate-950/50 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900/80 transition-all font-medium sm:text-sm [&::-ms-reveal]:hidden [&::-ms-clear]:hidden"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors focus:outline-none"
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
                className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
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
          <div className="px-8 py-4 bg-slate-50/80 dark:bg-slate-950/30 border-t border-slate-100 dark:border-white/5 text-center flex justify-between items-center text-[10px] text-slate-500">
            <span className="font-medium">v1.2.0</span>
            <span className="flex items-center gap-1 font-medium">
              Powered by <span className="font-bold text-slate-700 dark:text-slate-400">Borde Studio</span> <Sparkles className="w-3 h-3 text-amber-500" />
            </span>
          </div>

        </div>

        {/* Shadow reflection */}
        <div className="absolute -bottom-4 left-4 right-4 h-4 bg-black/10 dark:bg-black/40 blur-xl rounded-[100%]"></div>
      </div>
    </div>
  );
};