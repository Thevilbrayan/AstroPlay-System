import React, { useEffect, useState } from 'react';
import { pb } from '../lib/pocketbase';
import { useWorkstationStore } from '../store/workstation.store';
import { useAuthStore } from '../store/auth.store';
import { Monitor, CheckCircle2, Loader2, Lock, Plus, X, Check } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { TitleBar } from './layout/TitleBar';

interface Workstation {
    id: string;
    name: string;
    type: 'FULL_SERVICE' | 'SNACK_ONLY' | 'TIME_ONLY' | 'DINO_TREN';
    is_active: boolean;
    train_capacity?: number;
    dino_capacity?: number;
    gokart_capacity?: number;
    playground_capacity?: number;
}

const TYPE_LABELS: Record<string, string> = {
    FULL_SERVICE: 'AstroPlay — Tiempo + Calcetas + Snacks',
    DINO_TREN: 'Dino-Tren — Tiempo + Boletos',
    TIME_ONLY: 'GoKarts — Solo Tiempo',
    SNACK_ONLY: 'Solo Snacks',
};

export const WorkstationSetup: React.FC = () => {
    const { setWorkstation } = useWorkstationStore();
    const { user, logout } = useAuthStore();
    const isAdmin = user?.role === 'admin';

    const [workstations, setWorkstations] = useState<Workstation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Create form state
    const [showCreate, setShowCreate] = useState(false);
    const [createName, setCreateName] = useState('');
    const [createType, setCreateType] = useState<'FULL_SERVICE' | 'SNACK_ONLY' | 'TIME_ONLY' | 'DINO_TREN'>('FULL_SERVICE');
    const [isCreating, setIsCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    // Only fetch workstations for admins — operators never select a workstation
    useEffect(() => {
        if (!isAdmin) {
            setIsLoading(false);
            return;
        }
        fetchWorkstations();
    }, [isAdmin]);

    const fetchWorkstations = async () => {
        setIsLoading(true);
        try {
            const records = await pb.collection('workstations').getFullList<Workstation>({
                filter: 'is_active = true',
                sort: 'name',
                $autoCancel: false,
            });
            setWorkstations(records);
            setError(null);
        } catch (err: any) {
            console.error('Error fetching workstations:', err);
            setError('No se pudieron cargar las estaciones de trabajo. Verifica tu conexión.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelect = (ws: Workstation) => {
        setWorkstation(ws.id, ws.name, ws.type, ws.train_capacity, ws.dino_capacity, ws.gokart_capacity, ws.playground_capacity);
    };

    const handleCreate = async () => {
        if (!createName.trim()) {
            setCreateError('El nombre es obligatorio.');
            return;
        }
        setIsCreating(true);
        setCreateError(null);
        try {
            await pb.collection('workstations').create({
                name: createName.trim(),
                type: createType,
                is_active: true,
            });
            setShowCreate(false);
            setCreateName('');
            setCreateType('FULL_SERVICE');
            await fetchWorkstations();
        } catch (err: any) {
            console.error('Error creating workstation:', err);
            setCreateError('No se pudo crear la caja. Verifica los permisos en PocketBase.');
        } finally {
            setIsCreating(false);
        }
    };

    // Operators should never select a workstation — admin sets it up per device
    if (!isAdmin) {
        return (
            <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex items-center justify-center p-4 pt-9">
                <TitleBar />
                <Card className="w-full max-w-md bg-white dark:bg-slate-900 border-slate-200 dark:border-white/5 shadow-2xl rounded-3xl relative overflow-hidden">
                    <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
                    <CardContent className="p-8 flex flex-col items-center text-center">
                        <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-white/5 mb-4">
                            <Lock className="w-8 h-8 text-slate-400 dark:text-slate-500" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-3">Estación no configurada</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-6">
                            Esta computadora aún no tiene una caja asignada. Pide al administrador que configure la caja en este equipo antes de comenzar tu turno.
                        </p>
                        <button
                            onClick={logout}
                            className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-white/5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm font-medium transition-colors"
                        >
                            Cerrar sesión e ir al login
                        </button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex items-center justify-center p-4 pt-9">
                <TitleBar />
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
        );
    }

    return (
        <>
            <TitleBar />
            {/* Create workstation modal */}
            {showCreate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-slate-200 dark:border-slate-700/50">
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Nueva Caja</h2>
                        <div className="space-y-3">
                            <div>
                                <input
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                                    placeholder="Nombre de la caja (ej. Caja 1)"
                                    value={createName}
                                    onChange={(e) => setCreateName(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                                    autoFocus
                                />
                            </div>
                            <div>
                                <select
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
                                    value={createType}
                                    onChange={(e) => setCreateType(e.target.value as any)}
                                >
                                    <option value="FULL_SERVICE">AstroPlay — Tiempo + Calcetas + Snacks</option>
                                    <option value="DINO_TREN">Dino-Tren — Tiempo + Boletos</option>
                                    <option value="TIME_ONLY">GoKarts — Solo Tiempo</option>
                                    <option value="SNACK_ONLY">Solo Snacks</option>
                                </select>
                            </div>
                            {createError && (
                                <p className="text-red-500 text-xs">{createError}</p>
                            )}
                        </div>
                        <div className="flex justify-end gap-2 mt-5">
                            <button
                                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-white rounded-lg text-sm transition-colors"
                                onClick={() => { setShowCreate(false); setCreateError(null); setCreateName(''); }}
                                disabled={isCreating}
                            >
                                <X className="w-4 h-4 inline-block mr-1" />Cancelar
                            </button>
                            <button
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm flex items-center gap-1 transition-colors disabled:opacity-50"
                                onClick={handleCreate}
                                disabled={isCreating || !createName.trim()}
                            >
                                {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                Crear
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex items-center justify-center p-4 pt-9">
                <Card className="w-full max-w-md bg-white dark:bg-slate-900 border-slate-200 dark:border-white/5 shadow-2xl rounded-3xl relative overflow-hidden">
                    <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
                    <CardContent className="p-8">
                        <div className="flex flex-col items-center mb-8">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center border border-blue-500/20 mb-4 shadow-[0_0_30px_rgba(59,130,246,0.1)]">
                                <Monitor className="w-8 h-8 text-blue-500 dark:text-blue-400" />
                            </div>
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white text-center tracking-tight">Selecciona tu Caja</h2>
                            <p className="text-slate-500 dark:text-slate-400 text-center text-sm mt-2">
                                Esta estación será registrada en todas las transacciones generadas en este equipo.
                            </p>
                        </div>

                        {error ? (
                            <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-red-500 dark:text-red-400 text-sm text-center">
                                {error}
                                <Button variant="link" onClick={fetchWorkstations} className="mt-2 text-red-500 dark:text-red-300 hover:text-red-700 dark:hover:text-white font-medium block w-full p-0">Reintentar</Button>
                            </div>
                        ) : workstations.length === 0 ? (
                            <div className="flex flex-col items-center gap-4">
                                <div className="w-full p-4 bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20 rounded-xl flex flex-col items-center gap-1">
                                    <p className="text-yellow-700 dark:text-yellow-400 text-sm text-center font-medium">No hay cajas activas en el sistema.</p>
                                    <p className="text-yellow-600/70 dark:text-yellow-500/70 text-xs text-center">Crea la primera caja para comenzar.</p>
                                </div>
                                <Button
                                    onClick={() => setShowCreate(true)}
                                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl py-3"
                                >
                                    <Plus className="w-5 h-5" />
                                    Crear Nueva Caja
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {workstations.map(ws => (
                                    <Button
                                        key={ws.id}
                                        variant="outline"
                                        onClick={() => handleSelect(ws)}
                                        className="w-full h-auto flex items-center p-4 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 border-2 border-slate-200 dark:border-transparent hover:border-blue-500/30 rounded-2xl transition-all duration-300 group"
                                    >
                                        <div className="flex-1 text-left flex flex-col">
                                            <h3 className="text-slate-900 dark:text-white font-medium">{ws.name}</h3>
                                            <p className="text-xs text-slate-500 mt-0.5 tracking-wide font-normal">{TYPE_LABELS[ws.type] ?? ws.type}</p>
                                        </div>
                                        <div className="w-8 h-8 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center border border-slate-200 dark:border-white/5 group-hover:bg-blue-500/20 group-hover:border-blue-500/40 transition-colors">
                                            <CheckCircle2 className="w-4 h-4 text-slate-400 dark:text-slate-600 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors" />
                                        </div>
                                    </Button>
                                ))}
                                <button
                                    onClick={() => setShowCreate(true)}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500/40 text-slate-400 dark:text-slate-500 hover:text-blue-500 dark:hover:text-blue-400 text-sm transition-all duration-200"
                                >
                                    <Plus className="w-4 h-4" />
                                    Añadir otra caja
                                </button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </>
    );
};
