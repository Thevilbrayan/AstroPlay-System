// src/components/admin/StationManager.tsx
import React, { useEffect, useState } from 'react';
import { pb } from '../../lib/pocketbase';
import { Workstation } from '../../types';
import { useAuthStore } from '../../store/auth.store';
import { useWorkstationStore } from '../../store/workstation.store';
import { Monitor, Trash2, Plus, Check, X, Wifi, WifiOff, MonitorX, LogOut, AlertTriangle, Pencil } from 'lucide-react';

interface EditForm {
    name: string;
    type: 'FULL_SERVICE' | 'SNACK_ONLY' | 'TIME_ONLY' | 'DINO_TREN';
    playground_capacity: string;
    train_capacity: string;
    dino_capacity: string;
    gokart_capacity: string;
    is_active: boolean;
}

const TYPE_LABEL: Record<string, string> = {
    FULL_SERVICE: 'AstroPlay — Playground',
    SNACK_ONLY: 'Solo Snacks',
    TIME_ONLY: 'GoKarts',
    DINO_TREN: 'Dino-Tren',
};

const TYPE_BADGE: Record<string, string> = {
    FULL_SERVICE: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300',
    SNACK_ONLY: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300',
    TIME_ONLY: 'bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300',
    DINO_TREN: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300',
};

export const StationManager: React.FC = () => {
    const { user } = useAuthStore();
    const { workstationId, workstationName, clearWorkstation } = useWorkstationStore();
    const [stations, setStations] = useState<Workstation[]>([]);
    const [loading, setLoading] = useState(true);

    // Create modal
    const [showModal, setShowModal] = useState(false);
    const [newName, setNewName] = useState('');
    const [newType, setNewType] = useState<EditForm['type']>('FULL_SERVICE');
    const [newActive, setNewActive] = useState(true);
    const [newTrainCapacity, setNewTrainCapacity] = useState('');
    const [newDinoCapacity, setNewDinoCapacity] = useState('');
    const [newGokartCapacity, setNewGokartCapacity] = useState('');
    const [newPlaygroundCapacity, setNewPlaygroundCapacity] = useState('');

    // Inline edit state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<EditForm>({
        name: '', type: 'FULL_SERVICE',
        playground_capacity: '', train_capacity: '', dino_capacity: '', gokart_capacity: '',
        is_active: true,
    });

    // Delete confirmation
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

    // Liberar estación
    const [isConfirmingRelease, setIsConfirmingRelease] = useState(false);

    const loadStations = async () => {
        try {
            const records = await pb.collection('workstations').getFullList<Workstation>({ sort: 'name', $autoCancel: false });
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

    if (user?.role !== 'admin') return (
        <div className="flex items-center justify-center h-full text-red-500">
            <p className="text-lg font-semibold">Acceso denegado</p>
        </div>
    );

    const startEdit = (ws: Workstation) => {
        setEditingId(ws.id!);
        setEditForm({
            name: ws.name,
            type: ws.type ?? 'FULL_SERVICE',
            playground_capacity: String(ws.playground_capacity ?? ''),
            train_capacity: String(ws.train_capacity ?? ''),
            dino_capacity: String(ws.dino_capacity ?? ''),
            gokart_capacity: String(ws.gokart_capacity ?? ''),
            is_active: ws.is_active ?? true,
        });
    };

    const cancelEdit = () => {
        setEditingId(null);
    };

    const saveEdit = async () => {
        if (!editingId || !editForm.name.trim()) return;
        const payload: Partial<Workstation> = {
            name: editForm.name.trim(),
            type: editForm.type,
            is_active: editForm.is_active,
            playground_capacity: editForm.type === 'FULL_SERVICE' && editForm.playground_capacity
                ? parseInt(editForm.playground_capacity) : undefined,
            train_capacity: editForm.type === 'DINO_TREN' && editForm.train_capacity
                ? parseInt(editForm.train_capacity) : undefined,
            dino_capacity: editForm.type === 'DINO_TREN' && editForm.dino_capacity
                ? parseInt(editForm.dino_capacity) : undefined,
            gokart_capacity: editForm.type === 'TIME_ONLY' && editForm.gokart_capacity
                ? parseInt(editForm.gokart_capacity) : undefined,
        };
        try {
            await pb.collection('workstations').update(editingId, payload);
            setEditingId(null);
            await loadStations();
        } catch (e) { console.error('Save failed', e); }
    };

    const handleCreate = async () => {
        if (!newName.trim()) return;
        try {
            const payload: Record<string, any> = { name: newName.trim(), type: newType, is_active: newActive };
            if (newType === 'FULL_SERVICE' && newPlaygroundCapacity) payload.playground_capacity = parseInt(newPlaygroundCapacity);
            if (newType === 'DINO_TREN') {
                if (newTrainCapacity) payload.train_capacity = parseInt(newTrainCapacity);
                if (newDinoCapacity) payload.dino_capacity = parseInt(newDinoCapacity);
            }
            if (newType === 'TIME_ONLY' && newGokartCapacity) payload.gokart_capacity = parseInt(newGokartCapacity);
            await pb.collection('workstations').create(payload);
            setShowModal(false);
            setNewName(''); setNewType('FULL_SERVICE'); setNewActive(true);
            setNewTrainCapacity(''); setNewDinoCapacity(''); setNewGokartCapacity(''); setNewPlaygroundCapacity('');
            await loadStations();
        } catch (e) { console.error('Create failed', e); }
    };

    const handleDeleteConfirm = async () => {
        if (!deleteTargetId) return;
        try {
            await pb.collection('workstations').delete(deleteTargetId);
            setDeleteTargetId(null);
            if (editingId === deleteTargetId) setEditingId(null);
            await loadStations();
        } catch (e) { console.error('Delete failed', e); }
    };

    const isOnline = (updated?: string) => {
        if (!updated) return false;
        return Date.now() - new Date(updated).getTime() < 5 * 60 * 1000;
    };

    return (
        <div className="p-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Gestión de Estaciones</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                        {stations.length} estación{stations.length !== 1 ? 'es' : ''} registrada{stations.length !== 1 ? 's' : ''}
                    </p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-colors shadow-sm"
                >
                    <Plus className="w-4 h-4" /> Nueva Estación
                </button>
            </div>

            {/* Create Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-slate-200 dark:border-slate-700/50">
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Nueva Estación</h2>
                        <div className="space-y-3">
                            <input
                                autoFocus
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-sm"
                                placeholder="Nombre (ej. Caja 1)"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                            />
                            <select
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-sm"
                                value={newType}
                                onChange={(e) => setNewType(e.target.value as EditForm['type'])}
                            >
                                <option value="FULL_SERVICE">AstroPlay — Tiempo + Calcetas + Snacks</option>
                                <option value="DINO_TREN">Dino-Tren — Tiempo + Boletos</option>
                                <option value="TIME_ONLY">GoKarts — Solo Tiempo</option>
                                <option value="SNACK_ONLY">Solo Snacks</option>
                            </select>
                            {newType === 'FULL_SERVICE' && (
                                <div>
                                    <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Aforo del Playground (niños simultáneos)</label>
                                    <input type="number" min="1" className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-sm" placeholder="Ej. 50" value={newPlaygroundCapacity} onChange={(e) => setNewPlaygroundCapacity(e.target.value)} />
                                </div>
                            )}
                            {newType === 'DINO_TREN' && (
                                <>
                                    <div>
                                        <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Capacidad del tren (pasajeros/viaje)</label>
                                        <input type="number" min="1" className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 text-sm" placeholder="Ej. 20" value={newTrainCapacity} onChange={(e) => setNewTrainCapacity(e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Cantidad de dinosaurios (sesiones simultáneas)</label>
                                        <input type="number" min="1" className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 text-sm" placeholder="Ej. 10" value={newDinoCapacity} onChange={(e) => setNewDinoCapacity(e.target.value)} />
                                    </div>
                                </>
                            )}
                            {newType === 'TIME_ONLY' && (
                                <div>
                                    <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Cantidad de GoKarts</label>
                                    <input type="number" min="1" className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/40 text-sm" placeholder="Ej. 8" value={newGokartCapacity} onChange={(e) => setNewGokartCapacity(e.target.value)} />
                                </div>
                            )}
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={newActive} onChange={(e) => setNewActive(e.target.checked)} className="rounded" />
                                <span className="text-sm text-slate-700 dark:text-slate-300">Activa al crear</span>
                            </label>
                        </div>
                        <div className="flex justify-end gap-2 mt-5">
                            <button onClick={() => { setShowModal(false); setNewName(''); setNewPlaygroundCapacity(''); setNewTrainCapacity(''); setNewDinoCapacity(''); setNewGokartCapacity(''); }} className="px-3 py-2 text-sm rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors">
                                Cancelar
                            </button>
                            <button onClick={handleCreate} disabled={!newName.trim()} className="px-3 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors disabled:opacity-40 flex items-center gap-1.5">
                                <Check className="w-4 h-4" /> Crear
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteTargetId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-slate-200 dark:border-slate-700/50">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-500/20 flex items-center justify-center flex-shrink-0">
                                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-slate-900 dark:text-white">Eliminar estación</h2>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Esta acción no se puede deshacer.</p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setDeleteTargetId(null)} className="px-4 py-2 text-sm rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors">
                                Cancelar
                            </button>
                            <button onClick={handleDeleteConfirm} className="px-4 py-2 text-sm rounded-xl bg-red-600 hover:bg-red-500 text-white font-medium transition-colors">
                                Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Station Grid */}
            {loading ? (
                <p className="text-slate-500 dark:text-slate-400">Cargando estaciones…</p>
            ) : stations.length === 0 ? (
                <div className="text-center py-16 text-slate-400 dark:text-slate-600">
                    <Monitor className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">No hay estaciones. Crea la primera.</p>
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {stations.map((ws) => {
                        const online = isOnline(ws.updated);
                        const isEditing = editingId === ws.id;

                        return (
                            <div key={ws.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col gap-3">

                                {isEditing ? (
                                    /* ─── EDIT MODE ─── */
                                    <>
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-blue-500 mb-1">Editando</p>

                                        <div>
                                            <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-600 mb-1 block">Nombre</label>
                                            <input
                                                autoFocus
                                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                                                value={editForm.name}
                                                onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
                                                onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                                            />
                                        </div>

                                        <div>
                                            <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-600 mb-1 block">Tipo</label>
                                            <select
                                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                                                value={editForm.type}
                                                onChange={(e) => setEditForm(f => ({ ...f, type: e.target.value as EditForm['type'] }))}
                                            >
                                                <option value="FULL_SERVICE">AstroPlay — Playground</option>
                                                <option value="DINO_TREN">Dino-Tren — Tiempo + Boletos</option>
                                                <option value="TIME_ONLY">GoKarts — Solo Tiempo</option>
                                                <option value="SNACK_ONLY">Solo Snacks</option>
                                            </select>
                                        </div>

                                        {editForm.type === 'FULL_SERVICE' && (
                                            <div>
                                                <label className="text-[10px] font-semibold uppercase tracking-wider text-blue-500 dark:text-blue-400 mb-1 block">Aforo del Playground (niños)</label>
                                                <input type="number" min="1" className="w-full bg-slate-50 dark:bg-slate-800 border border-blue-200 dark:border-blue-500/30 rounded-lg px-3 py-1.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40" placeholder="Ej. 50" value={editForm.playground_capacity} onChange={(e) => setEditForm(f => ({ ...f, playground_capacity: e.target.value }))} />
                                            </div>
                                        )}

                                        {editForm.type === 'DINO_TREN' && (
                                            <>
                                                <div>
                                                    <label className="text-[10px] font-semibold uppercase tracking-wider text-emerald-500 mb-1 block">Cap. Tren (pasajeros/viaje)</label>
                                                    <input type="number" min="1" className="w-full bg-slate-50 dark:bg-slate-800 border border-emerald-200 dark:border-emerald-500/30 rounded-lg px-3 py-1.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40" placeholder="Ej. 20" value={editForm.train_capacity} onChange={(e) => setEditForm(f => ({ ...f, train_capacity: e.target.value }))} />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-semibold uppercase tracking-wider text-emerald-500 mb-1 block">Cantidad de Dinosaurios</label>
                                                    <input type="number" min="1" className="w-full bg-slate-50 dark:bg-slate-800 border border-emerald-200 dark:border-emerald-500/30 rounded-lg px-3 py-1.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40" placeholder="Ej. 10" value={editForm.dino_capacity} onChange={(e) => setEditForm(f => ({ ...f, dino_capacity: e.target.value }))} />
                                                </div>
                                            </>
                                        )}

                                        {editForm.type === 'TIME_ONLY' && (
                                            <div>
                                                <label className="text-[10px] font-semibold uppercase tracking-wider text-violet-500 dark:text-violet-400 mb-1 block">Cantidad de GoKarts</label>
                                                <input type="number" min="1" className="w-full bg-slate-50 dark:bg-slate-800 border border-violet-200 dark:border-violet-500/30 rounded-lg px-3 py-1.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40" placeholder="Ej. 8" value={editForm.gokart_capacity} onChange={(e) => setEditForm(f => ({ ...f, gokart_capacity: e.target.value }))} />
                                            </div>
                                        )}

                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" checked={editForm.is_active} onChange={(e) => setEditForm(f => ({ ...f, is_active: e.target.checked }))} className="rounded" />
                                            <span className="text-sm text-slate-600 dark:text-slate-400">Activa</span>
                                        </label>

                                        {/* Save / Cancel */}
                                        <div className="flex gap-2 pt-1">
                                            <button onClick={cancelEdit} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium transition-colors">
                                                <X className="w-4 h-4" /> Cancelar
                                            </button>
                                            <button onClick={saveEdit} disabled={!editForm.name.trim()} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-40">
                                                <Check className="w-4 h-4" /> Guardar
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    /* ─── READ-ONLY MODE ─── */
                                    <>
                                        {/* Online badge */}
                                        <div className={`flex items-center gap-1.5 text-[11px] font-medium self-start ${online ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-600'}`}>
                                            {online ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                                            {online ? 'En línea' : 'Desconectado'}
                                        </div>

                                        {/* Name + type */}
                                        <div>
                                            <p className="text-base font-bold text-slate-900 dark:text-white leading-tight">{ws.name}</p>
                                            <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${TYPE_BADGE[ws.type ?? 'FULL_SERVICE']}`}>
                                                {TYPE_LABEL[ws.type ?? 'FULL_SERVICE']}
                                            </span>
                                        </div>

                                        {/* Capacity info */}
                                        <div className="text-xs text-slate-500 dark:text-slate-400 space-y-0.5">
                                            {ws.type === 'FULL_SERVICE' && ws.playground_capacity && (
                                                <p>🏃 Aforo: <span className="font-semibold text-slate-700 dark:text-slate-300">{ws.playground_capacity} niños</span></p>
                                            )}
                                            {ws.type === 'TIME_ONLY' && ws.gokart_capacity && (
                                                <p>🏎 GoKarts: <span className="font-semibold text-slate-700 dark:text-slate-300">{ws.gokart_capacity} karts</span></p>
                                            )}
                                            {ws.type === 'DINO_TREN' && (
                                                <>
                                                    {ws.dino_capacity && <p>🦕 Dinos: <span className="font-semibold text-slate-700 dark:text-slate-300">{ws.dino_capacity} sesiones</span></p>}
                                                    {ws.train_capacity && <p>🚂 Tren: <span className="font-semibold text-slate-700 dark:text-slate-300">{ws.train_capacity} pasajeros/viaje</span></p>}
                                                </>
                                            )}
                                        </div>

                                        {/* Status + actions */}
                                        <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-100 dark:border-slate-800">
                                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ws.is_active ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                                {ws.is_active ? 'Activa' : 'Inactiva'}
                                            </span>
                                            <div className="flex items-center gap-1">
                                                <button onClick={() => startEdit(ws)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors" title="Editar">
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => setDeleteTargetId(ws.id!)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors" title="Eliminar">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Current Device Section */}
            {workstationId && (
                <div className="mt-10">
                    <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                        <MonitorX className="w-5 h-5 text-slate-400" /> Dispositivo actual
                    </h2>
                    <div className="bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-6 flex flex-col sm:flex-row justify-between gap-6">
                        <div className="space-y-1">
                            <span className="text-xs uppercase font-bold text-slate-400 dark:text-slate-500">Estación asignada</span>
                            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tracking-tight flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
                                {workstationName || 'Desconocida'}
                            </p>
                        </div>
                        <div className="flex flex-col justify-center min-w-[200px]">
                            {!isConfirmingRelease ? (
                                <button onClick={() => setIsConfirmingRelease(true)} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-medium border border-slate-300 dark:border-slate-700 transition-colors">
                                    Reasignar Estación
                                </button>
                            ) : (
                                <div className="space-y-2 w-full">
                                    <button onClick={clearWorkstation} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500/20 hover:bg-red-500 text-red-600 dark:text-red-400 hover:text-white rounded-xl font-bold ring-1 ring-red-500/50 transition-colors">
                                        <LogOut className="w-4 h-4" /> Ejecutar
                                    </button>
                                    <button onClick={() => setIsConfirmingRelease(false)} className="w-full text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                                        Cancelar
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
