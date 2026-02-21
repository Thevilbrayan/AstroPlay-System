// src/components/admin/StationManager.tsx
import React, { useEffect, useState } from 'react';
import { pb } from '../../lib/pocketbase';
import { Workstation } from '../../types';
import { useAuthStore } from '../../store/auth.store';
import { Monitor, Trash2, Plus, Check, X } from 'lucide-react';
import { cn } from '../../lib/utils';

// Simple Access Denied placeholder
const AccessDenied: React.FC = () => (
    <div className="flex items-center justify-center h-full text-red-400">
        <h2 className="text-2xl font-bold">Acceso denegado</h2>
    </div>
);

export const StationManager: React.FC = () => {
    const { user } = useAuthStore();
    const [stations, setStations] = useState<Workstation[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [newName, setNewName] = useState('');
    const [newType, setNewType] = useState<'FULL_SERVICE' | 'SNACK_ONLY' | 'TIME_ONLY'>('FULL_SERVICE');
    const [newActive, setNewActive] = useState(true);

    // Fetch stations on mount and after changes
    const loadStations = async () => {
        try {
            const records = await pb.collection('workstations').getFullList<Workstation>({
                sort: 'name',
                $autoCancel: false,
            });
            setStations(records);
        } catch (e) {
            console.error('Error loading stations', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user?.role === 'admin') loadStations();
    }, [user]);

    if (user?.role !== 'admin') return <AccessDenied />;

    const handleUpdate = async (id: string, updates: Partial<Workstation>) => {
        try {
            await pb.collection('workstations').update(id, updates);
            await loadStations();
        } catch (e) {
            console.error('Update failed', e);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('¿Eliminar esta estación?')) return;
        try {
            await pb.collection('workstations').delete(id);
            await loadStations();
        } catch (e) {
            console.error('Delete failed', e);
        }
    };

    const handleCreate = async () => {
        if (!newName.trim()) return;
        try {
            await pb.collection('workstations').create({
                name: newName,
                type: newType,
                is_active: newActive,
            });
            setShowModal(false);
            setNewName('');
            setNewType('FULL_SERVICE');
            setNewActive(true);
            await loadStations();
        } catch (e) {
            console.error('Create failed', e);
        }
    };

    const isOnline = (updated?: string) => {
        if (!updated) return false;
        const diff = Date.now() - new Date(updated).getTime();
        // consider online if updated within last 5 minutes
        return diff < 5 * 60 * 1000;
    };

    return (
        <div className="p-8 min-h-screen bg-slate-950 text-slate-100">
            <h1 className="text-3xl font-bold mb-6">Gestión de Estaciones</h1>

            {/* New Station Modal */}
            {showModal && (
                <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-slate-900 rounded-xl p-6 w-full max-w-md shadow-2xl border border-slate-700/50">
                        <h2 className="text-xl font-semibold mb-4">Añadir Nueva Estación</h2>
                        <div className="space-y-4">
                            <input
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded focus:outline-none"
                                placeholder="Nombre"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                            />
                            <select
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded"
                                value={newType}
                                onChange={(e) => setNewType(e.target.value as any)}
                            >
                                <option value="FULL_SERVICE">FULL_SERVICE</option>
                                <option value="SNACK_ONLY">SNACK_ONLY</option>
                                <option value="TIME_ONLY">TIME_ONLY</option>
                            </select>
                            <label className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    checked={newActive}
                                    onChange={(e) => setNewActive(e.target.checked)}
                                />
                                <span>Activa</span>
                            </label>
                        </div>
                        <div className="flex justify-end mt-6 space-x-2">
                            <button
                                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded"
                                onClick={() => setShowModal(false)}
                            >
                                <X className="w-4 h-4 inline-block mr-1" /> Cancelar
                            </button>
                            <button
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded flex items-center"
                                onClick={handleCreate}
                            >
                                <Check className="w-4 h-4 mr-1" /> Crear
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <button
                className="mb-4 flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded"
                onClick={() => setShowModal(true)}
            >
                <Plus className="w-5 h-5" /> Añadir Nueva Estación
            </button>

            {loading ? (
                <p>Cargando estaciones…</p>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {stations.map((ws) => (
                        <div
                            key={ws.id}
                            className="bg-slate-900/60 backdrop-blur-md border border-slate-700/40 rounded-xl p-4 relative"
                        >
                            {/* Connection Indicator */}
                            <div className="absolute top-2 right-2 flex items-center space-x-1">
                                <Monitor className={cn('w-4 h-4', isOnline(ws.updated) ? 'text-emerald-400' : 'text-red-500')} />
                                <span className="text-xs">{isOnline(ws.updated) ? 'En línea' : 'Desconectado'}</span>
                            </div>

                            <div className="flex flex-col gap-2">
                                {/* Name */}
                                <input
                                    className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white"
                                    value={ws.name}
                                    onChange={(e) => handleUpdate(ws.id!, { name: e.target.value })}
                                />
                                {/* Type selector */}
                                <select
                                    className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white"
                                    value={ws.type}
                                    onChange={(e) => handleUpdate(ws.id!, { type: e.target.value as any })}
                                >
                                    <option value="FULL_SERVICE">FULL_SERVICE</option>
                                    <option value="SNACK_ONLY">SNACK_ONLY</option>
                                    <option value="TIME_ONLY">TIME_ONLY</option>
                                </select>
                                {/* Active switch */}
                                <label className="flex items-center space-x-2">
                                    <input
                                        type="checkbox"
                                        checked={ws.is_active}
                                        onChange={(e) => handleUpdate(ws.id!, { is_active: e.target.checked })}
                                    />
                                    <span>Activa</span>
                                </label>
                                {/* Delete button */}
                                <button
                                    className="self-end text-red-400 hover:text-red-200"
                                    onClick={() => handleDelete(ws.id!)}
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
