import React, { useEffect, useState } from 'react';
import { pb } from '../../lib/pocketbase';
import { Asset, Workstation } from '../../types';
import { useAuthStore } from '../../store/auth.store';
import { Wrench, Plus, Trash2, Box } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';

export const HardwareConfig: React.FC = () => {
    const { user } = useAuthStore();
    const [assets, setAssets] = useState<Asset[]>([]);
    const [workstations, setWorkstations] = useState<Workstation[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    // Form state
    const [newName, setNewName] = useState('');
    const [newType, setNewType] = useState('');
    const [newStatus, setNewStatus] = useState<'available' | 'in_use' | 'maintenance'>('available');
    const [newWorkstation, setNewWorkstation] = useState('');

    useEffect(() => {
        if (user?.role === 'admin') {
            loadData();
        }
    }, [user]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [assetRecords, stationRecords] = await Promise.all([
                pb.collection('assets').getFullList<Asset>({ sort: '-created' }),
                pb.collection('workstations').getFullList<Workstation>({ sort: 'name' })
            ]);
            setAssets(assetRecords);
            setWorkstations(stationRecords);
        } catch (e) {
            console.error('Error loading hardware data', e);
        } finally {
            setLoading(false);
        }
    };

    if (user?.role !== 'admin') {
        return (
            <div className="flex items-center justify-center h-full text-red-400">
                <h2 className="text-2xl font-bold">Acceso denegado</h2>
            </div>
        );
    }

    const handleCreate = async () => {
        if (!newName.trim() || !newWorkstation) return;
        try {
            await pb.collection('assets').create({
                name: newName,
                type: newType,
                status: newStatus,
                workstation: newWorkstation,
            });
            setShowModal(false);
            setNewName('');
            setNewType('');
            setNewStatus('available');
            setNewWorkstation('');
            await loadData();
        } catch (e) {
            console.error('Create asset failed', e);
        }
    };

    const handleUpdate = async (id: string, updates: Partial<Asset>) => {
        try {
            await pb.collection('assets').update(id, updates);
            await loadData(); // Reload to sync
        } catch (e) {
            console.error('Update asset failed', e);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!window.confirm(`¿Eliminar activo físico "${name}"?`)) return;
        try {
            await pb.collection('assets').delete(id);
            await loadData();
        } catch (e) {
            console.error('Delete asset failed', e);
        }
    };

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'available': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
            case 'in_use': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
            case 'maintenance': return 'bg-red-500/20 text-red-400 border-red-500/30';
            default: return 'bg-slate-800 text-slate-400 border-slate-700';
        }
    };

    return (
        <div className="p-8 h-full overflow-y-auto bg-slate-950 text-slate-100 font-sans">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <Wrench className="w-8 h-8 text-blue-500" />
                        Configuración de Hardware
                    </h1>
                    <p className="text-slate-400 mt-2">Gestiona el inventario de activos físicos por estación (ej: Carritos, Dinos)</p>
                </div>
                <Button onClick={() => setShowModal(true)} className="gap-2">
                    <Plus className="w-5 h-5" /> Añadir Activo
                </Button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center p-12">
                    <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {assets.map((asset) => (
                        <div key={asset.id} className="bg-slate-900/60 backdrop-blur-md border border-slate-700/40 rounded-xl p-5 flex flex-col gap-4 shadow-xl relative group hover:border-blue-500/30 transition-all">

                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-2">
                                    <Box className="w-5 h-5 text-slate-500" />
                                    <h3 className="font-bold text-lg text-slate-200">{asset.name}</h3>
                                </div>
                                <button onClick={() => handleDelete(asset.id, asset.name)} className="text-slate-600 hover:text-red-400 transition-colors">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 mb-1 block">Estación Asignada</label>
                                    <select
                                        className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500/50"
                                        value={asset.workstation || ''}
                                        onChange={(e) => handleUpdate(asset.id, { workstation: e.target.value })}
                                    >
                                        <option value="">-- Sin asignar --</option>
                                        {workstations.map(ws => (
                                            <option key={ws.id} value={ws.id}>{ws.name} ({ws.type})</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <label className="text-xs font-semibold text-slate-500 mb-1 block">Estado</label>
                                        <select
                                            className={cn("w-full border rounded-lg px-3 py-2 text-sm font-medium focus:outline-none", getStatusStyle(asset.status))}
                                            value={asset.status}
                                            onChange={(e) => handleUpdate(asset.id, { status: e.target.value as any })}
                                        >
                                            <option className="bg-slate-800 text-white" value="available">Disponible</option>
                                            <option className="bg-slate-800 text-white" value="in_use">En Uso</option>
                                            <option className="bg-slate-800 text-white" value="maintenance">Mantenimiento</option>
                                        </select>
                                    </div>
                                    <div className="flex-1">
                                        <label className="text-xs font-semibold text-slate-500 mb-1 block">Categoría (Opcional)</label>
                                        <input
                                            className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none"
                                            value={asset.type || ''}
                                            placeholder="Ej: Go-Karts"
                                            onChange={(e) => handleUpdate(asset.id, { type: e.target.value })}
                                        />
                                    </div>
                                </div>

                                {asset.status === 'maintenance' && asset.last_report && (
                                    <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                                        <span className="text-[10px] uppercase font-bold text-red-400 block mb-1">Último Reporte</span>
                                        <p className="text-xs text-red-200/80 italic">{asset.last_report}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    {assets.length === 0 && (
                        <div className="col-span-full py-12 flex flex-col items-center justify-center text-slate-500 border border-dashed border-slate-700 rounded-2xl bg-slate-900/20">
                            <Box className="w-12 h-12 mb-3 opacity-20" />
                            <p>No hay activos registrados. Añade uno nuevo.</p>
                        </div>
                    )}
                </div>
            )}

            {/* Modal Crear */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-slate-900 w-full max-w-md rounded-2xl border border-slate-800 shadow-2xl p-6">
                        <h2 className="text-xl font-bold text-white mb-6">Nuevo Activo Físico</h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Nombre / Identificador</label>
                                <input
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:outline-none"
                                    placeholder="Ej: Carrito #05"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Estación a la que pertenece</label>
                                <select
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:outline-none"
                                    value={newWorkstation}
                                    onChange={(e) => setNewWorkstation(e.target.value)}
                                >
                                    <option value="" disabled>Selecciona una estación</option>
                                    {workstations.map(ws => (
                                        <option key={ws.id} value={ws.id}>{ws.name} ({ws.type})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Categoría</label>
                                    <input
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:outline-none"
                                        placeholder="Opcional"
                                        value={newType}
                                        onChange={(e) => setNewType(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Estado Inicial</label>
                                    <select
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:outline-none"
                                        value={newStatus}
                                        onChange={(e) => setNewStatus(e.target.value as any)}
                                    >
                                        <option value="available">Disponible</option>
                                        <option value="maintenance">Mantenimiento</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-8">
                            <Button variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
                            <Button onClick={handleCreate} disabled={!newName || !newWorkstation}>Guardar Activo</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
