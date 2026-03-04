import React, { useState, useEffect } from 'react';
import { pb } from '../../lib/pocketbase';
import { User } from '../../types';
import { useAuthStore } from '../../store/auth.store';
import {
    UserCog, Plus, Pencil, Trash2, Loader2, ShieldAlert,
    Eye, EyeOff, X, Check, UserRound, Camera,
} from 'lucide-react';
import ModalAlert, { AlertType } from '../ui/ModalAlert';

type FormMode = 'create' | 'edit';

interface UserForm {
    name: string;
    email: string;
    role: 'admin' | 'operator';
    password: string;
    passwordConfirm: string;
}

const ROLE_LABELS: Record<string, string> = {
    admin: 'Administrador',
    operator: 'Operador',
};

const ROLE_COLORS: Record<string, string> = {
    admin: 'bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-500/20',
    operator: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20',
};

const UserAvatar: React.FC<{ name?: string; avatarUrl?: string }> = ({ name, avatarUrl }) => {
    const initials = (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
    if (avatarUrl) {
        return (
            <img
                src={avatarUrl}
                alt={name}
                className="w-9 h-9 rounded-full object-cover flex-shrink-0 shadow-sm ring-2 ring-blue-100 dark:ring-blue-500/20"
            />
        );
    }
    return (
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-bold text-white text-sm flex-shrink-0 shadow-sm">
            {initials}
        </div>
    );
};

const emptyForm = (): UserForm => ({
    name: '', email: '', role: 'operator', password: '', passwordConfirm: '',
});

export const UsersView: React.FC = () => {
    const { user: currentUser } = useAuthStore();
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [formMode, setFormMode] = useState<FormMode>('create');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<UserForm>(emptyForm());
    const [showPassword, setShowPassword] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string>('');
    const [alert, setAlert] = useState<{ isOpen: boolean; type: AlertType; title: string; message: string }>({
        isOpen: false, type: 'info', title: '', message: '',
    });

    const loadUsers = async () => {
        setIsLoading(true);
        try {
            const records = await pb.collection('users').getFullList<User>({ sort: 'name', $autoCancel: false });
            setUsers(records);
        } catch (err) {
            console.error('Error loading users:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { loadUsers(); }, []);

    const openCreate = () => {
        setForm(emptyForm());
        setFormMode('create');
        setEditingId(null);
        setFormError(null);
        setShowPassword(false);
        setAvatarFile(null);
        setAvatarPreview('');
        setShowModal(true);
    };

    const openEdit = (u: User) => {
        setForm({ name: u.name, email: u.email, role: u.role, password: '', passwordConfirm: '' });
        setFormMode('edit');
        setEditingId(u.id);
        setFormError(null);
        setShowPassword(false);
        setAvatarFile(null);
        setAvatarPreview(u.avatar ? pb.files.getURL(u as any, u.avatar) : '');
        setShowModal(true);
    };

    const closeModal = () => { setShowModal(false); setFormError(null); setAvatarFile(null); setAvatarPreview(''); };

    const adminCount = users.filter(u => u.role === 'admin').length;
    // True when we cannot add more admins (unless editing an already-admin user)
    const isAdminLimitReached = (targetRole: 'admin' | 'operator') => {
        if (targetRole !== 'admin') return false;
        if (formMode === 'edit') {
            const editingUser = users.find(u => u.id === editingId);
            if (editingUser?.role === 'admin') return false; // already admin, no change
        }
        return adminCount >= 2;
    };

    const handleSave = async () => {
        setFormError(null);
        if (!form.name.trim()) { setFormError('El nombre es obligatorio.'); return; }
        if (!form.email.trim()) { setFormError('El correo electrónico es obligatorio.'); return; }
        if (formMode === 'create') {
            if (!form.password) { setFormError('La contraseña es obligatoria.'); return; }
            if (form.password.length < 8) { setFormError('La contraseña debe tener al menos 8 caracteres.'); return; }
            if (form.password !== form.passwordConfirm) { setFormError('Las contraseñas no coinciden.'); return; }
        }
        if (formMode === 'edit' && form.password) {
            if (form.password.length < 8) { setFormError('La nueva contraseña debe tener al menos 8 caracteres.'); return; }
            if (form.password !== form.passwordConfirm) { setFormError('Las contraseñas no coinciden.'); return; }
        }
        if (isAdminLimitReached(form.role)) {
            setFormError('Ya hay 2 administradores. El sistema permite un máximo de 2.');
            return;
        }

        setIsSaving(true);
        try {
            const fd = new FormData();
            fd.append('name', form.name.trim());
            fd.append('email', form.email.trim());
            fd.append('role', form.role);
            if (avatarFile) fd.append('avatar', avatarFile);

            if (formMode === 'create') {
                fd.append('emailVisibility', 'true');
                fd.append('password', form.password);
                fd.append('passwordConfirm', form.passwordConfirm);
                await pb.collection('users').create(fd);
                setAlert({ isOpen: true, type: 'success', title: 'Usuario Creado', message: `${form.name.trim()} ha sido registrado exitosamente.` });
            } else {
                if (form.password) {
                    fd.append('password', form.password);
                    fd.append('passwordConfirm', form.passwordConfirm);
                }
                await pb.collection('users').update(editingId!, fd);
                setAlert({ isOpen: true, type: 'success', title: 'Usuario Actualizado', message: `Los datos de ${form.name.trim()} han sido guardados.` });
            }
            closeModal();
            loadUsers();
        } catch (err: any) {
            const data = err?.response?.data || {};
            const msg = data.email?.message
                || data.password?.message
                || data.name?.message
                || err?.message
                || 'Error al guardar el usuario.';
            setFormError(msg);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (u: User) => {
        if (u.id === currentUser?.id) {
            setAlert({ isOpen: true, type: 'error', title: 'Acción no permitida', message: 'No puedes eliminar tu propia cuenta mientras estás conectado.' });
            return;
        }
        setDeletingId(u.id);
        try {
            await pb.collection('users').delete(u.id);
            loadUsers();
        } catch (err) {
            console.error('Delete error:', err);
            setAlert({ isOpen: true, type: 'error', title: 'Error', message: 'No se pudo eliminar el usuario. Puede que tenga registros asociados.' });
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 p-6 md:p-8 max-w-[1200px] mx-auto w-full transition-colors duration-300">

            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                        <UserCog className="w-8 h-8 text-blue-600 dark:text-blue-500" />
                        Gestión de Usuarios
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        Administra el acceso y los roles del personal.
                    </p>
                </div>
                <button
                    onClick={openCreate}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-colors shadow-sm"
                >
                    <Plus className="w-4 h-4" /> Nuevo Usuario
                </button>
            </header>

            {/* List */}
            <div className="flex-1 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden flex flex-col">
                {/* Table header */}
                <div className="grid grid-cols-[1fr_1fr_140px_96px] gap-4 p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <div>Nombre</div>
                    <div>Correo Electrónico</div>
                    <div>Rol</div>
                    <div className="text-right">Acciones</div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                        </div>
                    ) : users.length === 0 ? (
                        <div className="flex flex-col items-center justify-center text-slate-400 gap-3 py-20">
                            <UserRound className="w-12 h-12 opacity-20" />
                            <p>No hay usuarios registrados.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                            {users.map(u => (
                                <div
                                    key={u.id}
                                    className="grid grid-cols-[1fr_1fr_140px_96px] gap-4 p-4 items-center hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <UserAvatar name={u.name} avatarUrl={u.avatar ? pb.files.getURL(u as any, u.avatar) : ''} />
                                        <div className="min-w-0">
                                            <p className="font-bold text-slate-900 dark:text-white text-sm truncate">{u.name}</p>
                                            {u.id === currentUser?.id && (
                                                <p className="text-[10px] text-blue-500 font-bold">Tú</p>
                                            )}
                                        </div>
                                    </div>

                                    <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{u.email || <span className="text-slate-300 dark:text-slate-600">—</span>}</p>

                                    <div>
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${ROLE_COLORS[u.role] ?? ROLE_COLORS.operator}`}>
                                            {ROLE_LABELS[u.role] ?? u.role}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-end gap-1">
                                        <button
                                            onClick={() => openEdit(u)}
                                            className="p-2 rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"
                                            title="Editar usuario"
                                        >
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => u.id !== currentUser?.id && handleDelete(u)}
                                            disabled={deletingId === u.id || u.id === currentUser?.id}
                                            className="p-2 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
                                            title={u.id === currentUser?.id ? 'No puedes eliminar tu propia cuenta' : 'Eliminar usuario'}
                                        >
                                            {deletingId === u.id
                                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                                : <Trash2 className="w-4 h-4" />
                                            }
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ─── Create / Edit Modal ─── */}
            {showModal && (
                <div className="fixed inset-0 z-[150] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
                    <div className="w-full max-w-[480px] bg-white dark:bg-slate-900 rounded-[28px] shadow-2xl overflow-hidden animate-in zoom-in-95">

                        {/* Modal Header */}
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-500/10 rounded-2xl flex items-center justify-center">
                                    <UserCog className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                                    {formMode === 'create' ? 'Nuevo Usuario' : 'Editar Usuario'}
                                </h3>
                            </div>
                            <button
                                onClick={closeModal}
                                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 space-y-4">

                            {/* Avatar Upload */}
                            <div className="flex items-center gap-4">
                                <div className="relative group cursor-pointer">
                                    {avatarPreview ? (
                                        <img
                                            src={avatarPreview}
                                            alt="Avatar"
                                            className="w-16 h-16 rounded-full object-cover ring-2 ring-blue-200 dark:ring-blue-500/30"
                                        />
                                    ) : (
                                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-bold text-white text-xl">
                                            {(form.name || '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase() || '?'}
                                        </div>
                                    )}
                                    <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                        <Camera className="w-5 h-5 text-white" />
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    setAvatarFile(file);
                                                    setAvatarPreview(URL.createObjectURL(file));
                                                }
                                            }}
                                        />
                                    </label>
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{form.name || 'Nuevo Usuario'}</p>
                                    <p className="text-xs text-slate-400 mt-0.5">Pasa el cursor y haz click para cambiar foto</p>
                                </div>
                            </div>

                            {/* Name */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Nombre completo</label>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                    placeholder="Ej. María González"
                                    autoFocus
                                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors text-sm"
                                />
                            </div>

                            {/* Email */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Correo electrónico</label>
                                <input
                                    type="email"
                                    value={form.email}
                                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                                    placeholder="usuario@correo.com"
                                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors text-sm"
                                />
                            </div>

                            {/* Role */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Rol</label>
                                {editingId === currentUser?.id ? (
                                    <div className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
                                        <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
                                        <span className="text-sm text-slate-500 dark:text-slate-400">No puedes cambiar tu propio rol.</span>
                                    </div>
                                ) : (
                                    <>
                                        <div className="grid grid-cols-2 gap-2">
                                            {(['operator', 'admin'] as const).map(role => {
                                                const blocked = isAdminLimitReached(role);
                                                return (
                                                    <button
                                                        key={role}
                                                        type="button"
                                                        onClick={() => !blocked && setForm(f => ({ ...f, role }))}
                                                        disabled={blocked}
                                                        title={blocked ? 'Límite de 2 administradores alcanzado' : undefined}
                                                        className={`py-2.5 px-4 rounded-xl border-2 text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                                                            form.role === role
                                                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400'
                                                                : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                                                        }`}
                                                    >
                                                        {ROLE_LABELS[role]}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        {form.role === 'admin' && (
                                            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                                                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                                                Los administradores tienen acceso total al sistema.
                                            </p>
                                        )}
                                        {isAdminLimitReached('admin') && form.role !== 'admin' && (
                                            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                                                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                                                Límite de 2 administradores alcanzado.
                                            </p>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* Password */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                    {formMode === 'create' ? 'Contraseña' : 'Nueva contraseña (dejar vacío para no cambiar)'}
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={form.password}
                                        onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                                        placeholder={formMode === 'create' ? 'Mínimo 8 caracteres' : 'Sin cambios'}
                                        className="w-full px-3.5 py-2.5 pr-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors text-sm"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(v => !v)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            {/* Confirm password — show only when password field has a value */}
                            {(formMode === 'create' || form.password) && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Confirmar contraseña</label>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={form.passwordConfirm}
                                        onChange={e => setForm(f => ({ ...f, passwordConfirm: e.target.value }))}
                                        onKeyDown={e => e.key === 'Enter' && handleSave()}
                                        placeholder="Repite la contraseña"
                                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors text-sm"
                                    />
                                </div>
                            )}

                            {/* Error message */}
                            {formError && (
                                <p className="text-sm text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl px-3.5 py-2.5">
                                    {formError}
                                </p>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 pb-6 flex gap-3">
                            <button
                                onClick={closeModal}
                                className="flex-1 h-11 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition text-sm"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="flex-1 h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
                            >
                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                {formMode === 'create' ? 'Crear Usuario' : 'Guardar Cambios'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ModalAlert
                isOpen={alert.isOpen}
                type={alert.type}
                title={alert.title}
                message={alert.message}
                onClose={() => setAlert(prev => ({ ...prev, isOpen: false }))}
            />
        </div>
    );
};
