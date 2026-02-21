import React, { useState } from 'react';
import { MonitorX, LogOut, ShieldAlert } from 'lucide-react';
import { useWorkstationStore } from '../../store/workstation.store';

export const SettingsView: React.FC = () => {
    const { workstationName, clearWorkstation } = useWorkstationStore();
    const [isConfirming, setIsConfirming] = useState(false);

    const handleRelease = () => {
        clearWorkstation();
    };

    return (
        <div className="h-full flex items-start justify-center pt-10">
            <div className="max-w-xl w-full">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-white tracking-tight">Configuración del Sistema</h1>
                    <p className="text-slate-400 mt-2">Administración de Estaciones de Trabajo y Perfiles.</p>
                </div>

                {/* System Warning Alert */}
                <div className="mb-8 bg-blue-900/20 border border-blue-500/30 rounded-2xl p-4 flex gap-4">
                    <div className="p-2 bg-blue-500/20 rounded-lg h-fit">
                        <ShieldAlert className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                        <h3 className="text-blue-200 font-semibold mb-1">Zona Administrador</h3>
                        <p className="text-sm text-blue-300">
                            Estás accediendo a la configuración avanzada. Los cambios en la identidad de esta estación
                            afectarán el registro de ventas y seguimiento del punto de pago en línea.
                        </p>
                    </div>
                </div>

                {/* Workstation Lock Card */}
                <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 sm:p-8 relative overflow-hidden ring-1 ring-white/10">
                    {/* Decorative Blur */}
                    <div className="absolute top-[-50px] right-[-50px] w-32 h-32 bg-red-500/10 rounded-full blur-[50px] pointer-events-none"></div>

                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 relative z-10">
                        <div className="space-y-4">
                            <div>
                                <h2 className="text-xl font-bold text-white mb-2">Identidad de Caja</h2>
                                <p className="text-sm text-slate-400 leading-relaxed">
                                    Esta computadora está enlazada perpetuamente a la estación física y todos
                                    los cortes de caja y tiempos corren bajo esta firma de auditoría local.
                                </p>
                            </div>

                            <div className="flex flex-col space-y-1">
                                <span className="text-xs uppercase tracking-wider font-bold text-slate-500">Estación Asignada Actualmente</span>
                                <span className="text-2xl font-bold text-emerald-400 tracking-tight flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                                    {workstationName || 'Desconocida'}
                                </span>
                            </div>
                        </div>

                        <div className="sm:border-l border-slate-800 sm:pl-6 flex flex-col items-start min-w-[200px]">
                            <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
                                <MonitorX className="w-4 h-4 text-slate-400" />
                                Liberar Software
                            </h3>

                            {!isConfirming ? (
                                <button
                                    onClick={() => setIsConfirming(true)}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-medium transition-all shadow-lg hover:shadow-xl border border-slate-700"
                                >
                                    Reasignar Estación
                                </button>
                            ) : (
                                <div className="space-y-3 w-full animate-in fade-in slide-in-from-right-4">
                                    <p className="text-xs font-semibold text-red-400 uppercase tracking-widest text-center">
                                        ¿Estás Seguro?
                                    </p>
                                    <button
                                        onClick={handleRelease}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500/20 hover:bg-red-500 hover:text-white text-red-400 rounded-xl font-bold transition-all shadow-lg shadow-red-500/20 ring-1 ring-red-500/50 hover:ring-red-500"
                                    >
                                        <LogOut className="w-4 h-4" /> Ejecutar Liberación
                                    </button>
                                    <button
                                        onClick={() => setIsConfirming(false)}
                                        className="w-full flex items-center justify-center px-4 py-2 text-slate-400 hover:text-white text-sm transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            )}

                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};
