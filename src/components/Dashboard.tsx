import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/auth.store';
import {
    Users,
    Activity,
    DollarSign,
    UserPlus,
    LogOut,
    ShoppingBag,
    Clock,
    Rocket,
    AlertTriangle
} from 'lucide-react';

interface DashboardProps {
    onNavigate?: (view: 'dashboard' | 'checkin' | 'inventory') => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
    const { user } = useAuthStore();
    const [time, setTime] = useState(new Date());

    // Update clock every second
    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Mock data for Status Cards
    const stats = [
        { label: 'Niños Activos', value: '12', icon: Users, color: 'text-blue-400', border: 'border-blue-500/20' },
        { label: 'Capacidad Disponible', value: '85%', icon: Activity, color: 'text-green-400', border: 'border-green-500/20' },
        { label: 'Ventas del Turno', value: '$2,450', icon: DollarSign, color: 'text-yellow-400', border: 'border-yellow-500/20' },
    ];

    // Mock data for Time Monitor
    const activeChildren = [
        { id: 1, name: 'Mateo R.', timeElapsed: '1h 50m', timeLeft: 10, totalTime: 120, status: 'warning' },
        { id: 2, name: 'Sofía L.', timeElapsed: '1h 45m', timeLeft: 15, totalTime: 120, status: 'ok' },
        { id: 3, name: 'Lucas G.', timeElapsed: '0h 55m', timeLeft: 65, totalTime: 120, status: 'ok' },
        { id: 4, name: 'Valentina P.', timeElapsed: '0h 30m', timeLeft: 90, totalTime: 120, status: 'ok' },
        { id: 5, name: 'Diego M.', timeElapsed: '0h 15m', timeLeft: 105, totalTime: 120, status: 'ok' },
    ];

    return (
        <div className="min-h-screen bg-slate-950 p-6 text-slate-100 font-sans">

            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-slate-800/50 pb-6">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <Rocket className="w-8 h-8 text-blue-500" />
                        Centro de Mando
                    </h1>
                    <p className="text-slate-400 mt-1">
                        Hola, <span className="text-blue-400 font-semibold">{user?.name || 'Operador'}</span>. Sistema listo.
                    </p>
                </div>
                <div className="text-right bg-slate-900/50 px-6 py-3 rounded-2xl border border-slate-800 shadow-lg backdrop-blur-sm">
                    <div className="text-4xl font-mono font-bold text-slate-100 tracking-wider">
                        {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </div>
                    <div className="text-xs text-slate-500 uppercase tracking-widest mt-1">
                        {time.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                </div>
            </header>

            {/* Top Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {stats.map((stat, index) => (
                    <div key={index} className={`bg-slate-900/40 backdrop-blur-md border ${stat.border} p-6 rounded-2xl shadow-lg relative overflow-hidden group`}>
                        <div className="flex justify-between items-start relative z-10">
                            <div>
                                <p className="text-sm text-slate-400 uppercase tracking-wider font-medium">{stat.label}</p>
                                <h3 className="text-3xl font-bold mt-2 text-white">{stat.value}</h3>
                            </div>
                            <div className={`p-3 rounded-xl bg-slate-800/50 ${stat.color}`}>
                                <stat.icon className="w-6 h-6" />
                            </div>
                        </div>
                        {/* Hover effect glow */}
                        <div className={`absolute -bottom-4 -right-4 w-24 h-24 ${stat.color.replace('text-', 'bg-')}/10 blur-2xl rounded-full group-hover:scale-150 transition-transform duration-500`}></div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Main Content Area (Left - 2cols) - Time Monitor */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800 p-6 rounded-2xl shadow-lg">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-semibold flex items-center gap-2">
                                <Clock className="w-5 h-5 text-blue-400" />
                                Monitor de Tiempo Activo
                            </h3>
                            <span className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded border border-slate-700">Top 5 más antiguos</span>
                        </div>

                        <div className="space-y-4">
                            {activeChildren.map((child) => {
                                const progress = (child.timeLeft / child.totalTime) * 100;
                                const isWarning = child.timeLeft <= 15;

                                return (
                                    <div key={child.id} className="group">
                                        <div className="flex justify-between items-end mb-1 text-sm">
                                            <span className="font-medium text-slate-200">{child.name}</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-slate-400">{child.timeElapsed} transcurrido</span>
                                                <span className={`font-bold ${isWarning ? 'text-red-400 animate-pulse' : 'text-slate-500'}`}>
                                                    {isWarning && <AlertTriangle className="w-3 h-3 inline mr-1" />}
                                                    {child.timeLeft} min restantes
                                                </span>
                                            </div>
                                        </div>

                                        <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-1000 ${isWarning ? 'bg-red-500' : 'bg-green-500'}`}
                                                style={{ width: `${Math.max(5, progress)}%` }} // Ensure at least a little bit is visible
                                            ></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Sidebar (Right - 1col) - Quick Actions */}
                <div className="space-y-6">
                    <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800 p-6 rounded-2xl shadow-lg h-full">
                        <h3 className="text-xl font-semibold flex items-center gap-2 mb-6">
                            Acciones Rápidas
                        </h3>

                        <div className="grid gap-4">
                            <button
                                onClick={() => onNavigate?.('checkin')}
                                className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-blue-600/20 to-blue-500/10 border border-blue-500/30 hover:border-blue-400 hover:from-blue-600/30 transition-all group"
                            >
                                <div className="bg-blue-500 p-3 rounded-lg shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform">
                                    <UserPlus className="w-6 h-6 text-white" />
                                </div>
                                <div className="text-left">
                                    <span className="block font-bold text-blue-100">Nuevo Check-in</span>
                                    <span className="text-xs text-blue-300/70">Registrar entrada de niño</span>
                                </div>
                            </button>

                            <button className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-red-600/20 to-red-500/10 border border-red-500/30 hover:border-red-400 hover:from-red-600/30 transition-all group">
                                <div className="bg-red-500 p-3 rounded-lg shadow-lg shadow-red-500/20 group-hover:scale-110 transition-transform">
                                    <LogOut className="w-6 h-6 text-white" />
                                </div>
                                <div className="text-left">
                                    <span className="block font-bold text-red-100">Registrar Salida</span>
                                    <span className="text-xs text-red-300/70">Finalizar sesión de juego</span>
                                </div>
                            </button>

                            <button
                                onClick={() => onNavigate?.('inventory')}
                                className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-yellow-600/20 to-yellow-500/10 border border-yellow-500/30 hover:border-yellow-400 hover:from-yellow-600/30 transition-all group"
                            >
                                <div className="bg-yellow-500 p-3 rounded-lg shadow-lg shadow-yellow-500/20 group-hover:scale-110 transition-transform">
                                    <ShoppingBag className="w-6 h-6 text-white" />
                                </div>
                                <div className="text-left">
                                    <span className="block font-bold text-yellow-100">Venta Rápida</span>
                                    <span className="text-xs text-yellow-300/70">Snacks, calcetines, bebidas...</span>
                                </div>
                            </button>
                        </div>

                    </div>
                </div>

            </div>
        </div>
    );
};

export default Dashboard;
