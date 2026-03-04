import React, { useState, useEffect, useCallback } from 'react';
import { pb } from '../../lib/pocketbase';
import { Parent, Child, Session } from '../../types';
import {
    Search, User, Star, Calendar, Phone, Mail, CreditCard,
    Pencil, Trash2, Check, X, ChevronRight, AlertTriangle,
    Baby, Clock, Users, Loader2, Heart
} from 'lucide-react';
import { useSettingsStore } from '../../store/settings.store';

interface ChildWithAge extends Child {
    age: number;
}

interface RecentSession {
    id: string;
    date: string;
    duration: string;
    status: string;
}

// ── helpers ──────────────────────────────────────────────────────────────────

const calcAge = (birth: string) => {
    const b = new Date(birth);
    const today = new Date();
    let age = today.getFullYear() - b.getFullYear();
    const m = today.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age--;
    return Math.max(0, age);
};

const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });

const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

const initials = (name: string) =>
    name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();

// ── sub-components ────────────────────────────────────────────────────────────

const Avatar: React.FC<{ parent: Parent; size?: 'sm' | 'md' | 'lg' }> = ({ parent, size = 'md' }) => {
    const sizes = { sm: 'w-9 h-9 text-xs', md: 'w-12 h-12 text-sm', lg: 'w-16 h-16 text-lg' };
    const photoUrl = parent.face_photo ? pb.files.getURL(parent as any, parent.face_photo) : null;
    return photoUrl ? (
        <img src={photoUrl} alt={parent.name} className={`${sizes[size]} rounded-full object-cover ring-2 ring-slate-200 dark:ring-slate-700 flex-shrink-0`} />
    ) : (
        <div className={`${sizes[size]} rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white font-bold flex-shrink-0`}>
            {initials(parent.name)}
        </div>
    );
};

// ── main component ────────────────────────────────────────────────────────────

export const CustomersView: React.FC = () => {
    const { settings } = useSettingsStore();

    // List state
    const [parents, setParents] = useState<Parent[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const PER_PAGE = 20;

    // Detail state
    const [selected, setSelected] = useState<Parent | null>(null);
    const [children, setChildren] = useState<ChildWithAge[]>([]);
    const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
    const [loadingDetail, setLoadingDetail] = useState(false);

    // Edit state
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<Partial<Parent>>({});
    const [isSaving, setIsSaving] = useState(false);

    // Delete state
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // ── fetch list ──────────────────────────────────────────────────────────
    const loadParents = useCallback(async (q: string, p: number) => {
        setLoading(true);
        try {
            const filter = q.trim()
                ? `name ~ "${q}" || phone ~ "${q}" || email ~ "${q}"`
                : '';
            const result = await pb.collection('parents').getList<Parent>(p, PER_PAGE, {
                filter,
                sort: '-created',
                $autoCancel: false,
            });
            setParents(result.items);
            setTotalPages(result.totalPages);
            setTotalItems(result.totalItems);
        } catch (e) {
            console.error('Error loading parents', e);
        } finally {
            setLoading(false);
        }
    }, []);

    // Debounce search
    useEffect(() => {
        const t = setTimeout(() => {
            setPage(1);
            loadParents(search, 1);
        }, 300);
        return () => clearTimeout(t);
    }, [search, loadParents]);

    useEffect(() => {
        loadParents(search, page);
    }, [page]); // eslint-disable-line

    // ── fetch detail ────────────────────────────────────────────────────────
    const loadDetail = useCallback(async (parent: Parent) => {
        setLoadingDetail(true);
        setChildren([]);
        setRecentSessions([]);
        try {
            // Children
            const childRecords = await pb.collection('children').getFullList<Child>({
                filter: `parent = "${parent.id}"`,
                sort: 'name',
                $autoCancel: false,
            });
            setChildren(childRecords.map(c => ({ ...c, age: calcAge(c.birth_date) })));

            // Recent sessions
            const sessionRecords = await pb.collection('sessions').getList<Session>(1, 8, {
                filter: `parent = "${parent.id}" && (status = "finished" || status = "active")`,
                sort: '-created',
                $autoCancel: false,
            });
            setRecentSessions(sessionRecords.items.map(s => {
                const start = new Date(s.start_time || s.created || '').getTime();
                const end = s.end_time ? new Date(s.end_time).getTime() : Date.now();
                const durMin = Math.max(0, Math.round((end - start) / 60000));
                return {
                    id: s.id,
                    date: fmtDate(s.start_time || s.created || ''),
                    duration: `${durMin} min`,
                    status: s.status,
                };
            }));
        } catch (e) {
            console.error('Error loading detail', e);
        } finally {
            setLoadingDetail(false);
        }
    }, []);

    const handleSelect = (p: Parent) => {
        setSelected(p);
        setIsEditing(false);
        loadDetail(p);
    };

    // ── edit ────────────────────────────────────────────────────────────────
    const startEdit = () => {
        if (!selected) return;
        setEditForm({
            name: selected.name,
            email: selected.email ?? '',
            phone: selected.phone ?? '',
            card_id: selected.card_id ?? '',
            loyalty_points: selected.loyalty_points ?? 0,
        });
        setIsEditing(true);
    };

    const cancelEdit = () => setIsEditing(false);

    const saveEdit = async () => {
        if (!selected || !editForm.name?.trim()) return;
        setIsSaving(true);
        try {
            const updated = await pb.collection('parents').update<Parent>(selected.id, {
                name: editForm.name.trim(),
                email: editForm.email || null,
                phone: editForm.phone || null,
                card_id: editForm.card_id || null,
                loyalty_points: editForm.loyalty_points ?? 0,
            });
            setSelected(updated);
            setParents(prev => prev.map(p => p.id === updated.id ? updated : p));
            setIsEditing(false);
        } catch (e) {
            console.error('Save failed', e);
        } finally {
            setIsSaving(false);
        }
    };

    // ── delete ──────────────────────────────────────────────────────────────
    const handleDelete = async () => {
        if (!deleteTarget) return;
        setIsDeleting(true);
        try {
            await pb.collection('parents').delete(deleteTarget);
            setParents(prev => prev.filter(p => p.id !== deleteTarget));
            setTotalItems(n => n - 1);
            if (selected?.id === deleteTarget) setSelected(null);
            setDeleteTarget(null);
        } catch (e) {
            console.error('Delete failed', e);
        } finally {
            setIsDeleting(false);
        }
    };

    const pointsValue = (pts: number) =>
        ((pts ?? 0) * (settings?.points_redemption_value ?? 0.1)).toFixed(2);

    // ─────────────────────────────────────────────────────────────────────────

    return (
        <div className="flex h-full bg-slate-50 dark:bg-slate-950 overflow-hidden">

            {/* ── LEFT PANEL: list ── */}
            <div className={`flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-all duration-200 ${selected ? 'w-80 shrink-0' : 'flex-1'}`}>

                {/* Header */}
                <div className="px-5 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Clientes</h1>
                            <p className="text-xs text-slate-400 mt-0.5">{totalItems} registrado{totalItems !== 1 ? 's' : ''}</p>
                        </div>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-0 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                            placeholder="Buscar por nombre, teléfono…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                        </div>
                    ) : parents.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                            <Users className="w-10 h-10 mb-3 opacity-40" />
                            <p className="text-sm">{search ? 'Sin resultados' : 'No hay clientes aún'}</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {parents.map((p) => (
                                <button
                                    key={p.id}
                                    onClick={() => handleSelect(p)}
                                    className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${selected?.id === p.id ? 'bg-blue-50 dark:bg-blue-500/10' : ''}`}
                                >
                                    <Avatar parent={p} size="sm" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{p.name}</p>
                                        <p className="text-xs text-slate-400 truncate">{p.phone || p.email || 'Sin contacto'}</p>
                                    </div>
                                    <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                                        {(p.loyalty_points ?? 0) > 0 && (
                                            <span className="flex items-center gap-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                                                <Star className="w-3 h-3" />{p.loyalty_points}
                                            </span>
                                        )}
                                        <span className="text-[10px] text-slate-400">{p.total_visits ?? 0} visitas</span>
                                    </div>
                                    {selected?.id === p.id && <ChevronRight className="w-4 h-4 text-blue-500 flex-shrink-0" />}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 disabled:opacity-40 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                            Anterior
                        </button>
                        <span className="text-xs text-slate-400">{page} / {totalPages}</span>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 disabled:opacity-40 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                            Siguiente
                        </button>
                    </div>
                )}
            </div>

            {/* ── RIGHT PANEL: detail ── */}
            {selected ? (
                <div className="flex-1 overflow-y-auto">
                    {/* Detail Header */}
                    <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-8 py-5 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Avatar parent={selected} size="lg" />
                            <div>
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{selected.name}</h2>
                                <p className="text-sm text-slate-400 mt-0.5">
                                    Cliente desde {fmtDate(selected.created ?? '')}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {!isEditing && (
                                <>
                                    <button
                                        onClick={startEdit}
                                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-medium transition-colors"
                                    >
                                        <Pencil className="w-4 h-4" /> Editar
                                    </button>
                                    <button
                                        onClick={() => setDeleteTarget(selected.id)}
                                        className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                                        title="Eliminar cliente"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </>
                            )}
                            <button
                                onClick={() => setSelected(null)}
                                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    <div className="p-8 max-w-3xl space-y-8">

                        {/* Stats row */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-2xl p-4">
                                <div className="flex items-center gap-2 mb-1">
                                    <Star className="w-4 h-4 text-amber-500" />
                                    <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">Puntos</span>
                                </div>
                                <p className="text-2xl font-black text-amber-700 dark:text-amber-300">{selected.loyalty_points ?? 0}</p>
                                <p className="text-xs text-amber-600/70 dark:text-amber-400/60 mt-0.5">≈ ${pointsValue(selected.loyalty_points ?? 0)} MXN</p>
                            </div>
                            <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-2xl p-4">
                                <div className="flex items-center gap-2 mb-1">
                                    <Calendar className="w-4 h-4 text-blue-500" />
                                    <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">Visitas</span>
                                </div>
                                <p className="text-2xl font-black text-blue-700 dark:text-blue-300">{selected.total_visits ?? 0}</p>
                                <p className="text-xs text-blue-600/70 dark:text-blue-400/60 mt-0.5">visitas totales</p>
                            </div>
                            <div className="bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20 rounded-2xl p-4">
                                <div className="flex items-center gap-2 mb-1">
                                    <Baby className="w-4 h-4 text-violet-500" />
                                    <span className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wide">Niños</span>
                                </div>
                                <p className="text-2xl font-black text-violet-700 dark:text-violet-300">{children.length}</p>
                                <p className="text-xs text-violet-600/70 dark:text-violet-400/60 mt-0.5">registrados</p>
                            </div>
                        </div>

                        {/* Contact info / Edit form */}
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
                            <h3 className="text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-5">
                                {isEditing ? '✏️ Editando información' : 'Información de contacto'}
                            </h3>

                            {isEditing ? (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">Nombre *</label>
                                            <input
                                                autoFocus
                                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                                                value={editForm.name ?? ''}
                                                onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">Teléfono</label>
                                            <input
                                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                                                value={editForm.phone ?? ''}
                                                onChange={(e) => setEditForm(f => ({ ...f, phone: e.target.value }))}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">Correo</label>
                                            <input
                                                type="email"
                                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                                                value={editForm.email ?? ''}
                                                onChange={(e) => setEditForm(f => ({ ...f, email: e.target.value }))}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">ID Tarjeta</label>
                                            <input
                                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                                                value={editForm.card_id ?? ''}
                                                onChange={(e) => setEditForm(f => ({ ...f, card_id: e.target.value }))}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">Puntos de Lealtad</label>
                                            <input
                                                type="number"
                                                min="0"
                                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                                                value={editForm.loyalty_points ?? 0}
                                                onChange={(e) => setEditForm(f => ({ ...f, loyalty_points: parseInt(e.target.value) || 0 }))}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex gap-2 pt-2">
                                        <button onClick={cancelEdit} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium transition-colors">
                                            <X className="w-4 h-4" /> Cancelar
                                        </button>
                                        <button onClick={saveEdit} disabled={isSaving || !editForm.name?.trim()} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-40">
                                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                            Guardar
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-4">
                                    {[
                                        { icon: Phone, label: 'Teléfono', value: selected.phone },
                                        { icon: Mail, label: 'Correo', value: selected.email },
                                        { icon: CreditCard, label: 'ID Tarjeta', value: selected.card_id, mono: true },
                                        { icon: Calendar, label: 'Registrado', value: fmtDate(selected.created ?? '') },
                                    ].map(({ icon: Icon, label, value, mono }) => (
                                        <div key={label} className="flex items-start gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                                                <Icon className="w-4 h-4 text-slate-400" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                                                <p className={`text-sm text-slate-800 dark:text-slate-200 mt-0.5 ${mono ? 'font-mono' : ''}`}>
                                                    {value || <span className="text-slate-400 italic">No registrado</span>}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Children */}
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
                            <h3 className="text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-4">
                                Niños registrados
                            </h3>
                            {loadingDetail ? (
                                <div className="flex items-center gap-2 text-slate-400 text-sm py-2">
                                    <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
                                </div>
                            ) : children.length === 0 ? (
                                <p className="text-sm text-slate-400 italic py-2">Sin niños registrados.</p>
                            ) : (
                                <div className="space-y-3">
                                    {children.map((c) => (
                                        <div key={c.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-400 to-pink-400 flex items-center justify-center flex-shrink-0">
                                                <Baby className="w-4 h-4 text-white" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-slate-900 dark:text-white">{c.name}</p>
                                                <p className="text-xs text-slate-400">
                                                    {c.age} año{c.age !== 1 ? 's' : ''} · Nació {fmtDate(c.birth_date)}
                                                </p>
                                            </div>
                                            {c.allergies && (
                                                <div className="flex items-center gap-1 px-2 py-0.5 bg-red-100 dark:bg-red-500/20 rounded-full flex-shrink-0">
                                                    <Heart className="w-3 h-3 text-red-500" />
                                                    <span className="text-[10px] font-semibold text-red-600 dark:text-red-400 max-w-[80px] truncate">{c.allergies}</span>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Recent visits */}
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
                            <h3 className="text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-4">
                                Últimas visitas
                            </h3>
                            {loadingDetail ? (
                                <div className="flex items-center gap-2 text-slate-400 text-sm py-2">
                                    <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
                                </div>
                            ) : recentSessions.length === 0 ? (
                                <p className="text-sm text-slate-400 italic py-2">Sin visitas registradas.</p>
                            ) : (
                                <div className="space-y-2">
                                    {recentSessions.map((s) => (
                                        <div key={s.id} className="flex items-center gap-3 py-2.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
                                            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                                                <Clock className="w-4 h-4 text-slate-400" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm text-slate-800 dark:text-slate-200 font-medium">{s.date}</p>
                                                <p className="text-xs text-slate-400">{s.duration}</p>
                                            </div>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.status === 'active' ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                                {s.status === 'active' ? 'Activa' : 'Finalizada'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            ) : (
                /* Empty state */
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-600">
                    <User className="w-16 h-16 mb-4 opacity-30" />
                    <p className="text-base font-medium">Selecciona un cliente</p>
                    <p className="text-sm mt-1">para ver su información</p>
                </div>
            )}

            {/* Delete confirmation modal */}
            {deleteTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-slate-200 dark:border-slate-700/50">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-500/20 flex items-center justify-center flex-shrink-0">
                                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-slate-900 dark:text-white">Eliminar cliente</h2>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Se eliminarán también sus niños asociados.</p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors">
                                Cancelar
                            </button>
                            <button onClick={handleDelete} disabled={isDeleting} className="px-4 py-2 text-sm rounded-xl bg-red-600 hover:bg-red-500 text-white font-medium transition-colors disabled:opacity-40 flex items-center gap-1.5">
                                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
