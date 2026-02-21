import React, { useEffect, useState } from 'react';
import { pb } from '../lib/pocketbase';
import { useWorkstationStore } from '../store/workstation.store';
import { Monitor, CheckCircle2, Loader2 } from 'lucide-react';

interface Workstation {
    id: string;
    name: string;
    type: 'FULL_SERVICE' | 'SNACK_ONLY' | 'TIME_ONLY';
    is_active: boolean;
}

export const WorkstationSetup: React.FC = () => {
    const { setWorkstation } = useWorkstationStore();
    const [workstations, setWorkstations] = useState<Workstation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchWorkstations = async () => {
            try {
                const records = await pb.collection('workstations').getFullList<Workstation>({
                    filter: 'is_active = true',
                    sort: 'name',
                    $autoCancel: false,
                });
                setWorkstations(records);
            } catch (err: any) {
                console.error('Error fetching workstations:', err);
                setError('No se pudieron cargar las estaciones de trabajo. Verifica tu conexión.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchWorkstations();
    }, []);

    const handleSelect = (ws: Workstation) => {
        setWorkstation(ws.id, ws.name, ws.type);
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-slate-900 border border-white/5 shadow-2xl rounded-3xl p-8 relative overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />

                <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center border border-blue-500/20 mb-4 shadow-[0_0_30px_rgba(59,130,246,0.1)]">
                        <Monitor className="w-8 h-8 text-blue-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-white text-center tracking-tight">Selecciona tu Caja</h2>
                    <p className="text-slate-400 text-center text-sm mt-2">
                        Esta estación será registrada en todas las transacciones generadas en este equipo.
                    </p>
                </div>

                {error ? (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">
                        {error}
                        <button onClick={() => window.location.reload()} className="mt-2 text-red-300 underline hover:text-white font-medium block w-full">Reintentar</button>
                    </div>
                ) : workstations.length === 0 ? (
                    <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex flex-col items-center gap-2">
                        <p className="text-yellow-400 text-sm text-center font-medium">No hay cajas activas registradas en el sistema.</p>
                        <p className="text-yellow-500/70 text-xs text-center">Contacta a un administrador para que active una "workstation" en PocketBase.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {workstations.map(ws => (
                            <button
                                key={ws.id}
                                onClick={() => handleSelect(ws)}
                                className="w-full flex items-center p-4 bg-slate-800/50 hover:bg-slate-800 border-2 border-transparent hover:border-blue-500/30 rounded-2xl transition-all duration-300 group"
                            >
                                <div className="flex-1 text-left">
                                    <h3 className="text-white font-medium">{ws.name}</h3>
                                    <p className="text-xs text-slate-500 mt-0.5 uppercase tracking-wider">TIPO: {ws.type}</p>
                                </div>
                                <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center border border-white/5 group-hover:bg-blue-500/20 group-hover:border-blue-500/40 transition-colors">
                                    <CheckCircle2 className="w-4 h-4 text-slate-600 group-hover:text-blue-400 transition-colors" />
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
