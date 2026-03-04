import React, { useState } from 'react';
import {
    LayoutDashboard,
    Users,
    ShoppingBag,
    ShoppingCart,
    Settings,
    LogOut,
    Monitor,
    LineChart,
    Wallet,
    ShieldCheck,
    UserCog,
    HeartHandshake,
    Camera,
    Eye,
    EyeOff,
    X,
    Check,
    Loader2,
} from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';
import { useWorkstationStore } from '../../store/workstation.store';
import { cn } from '../../lib/utils';
import { pb } from '../../lib/pocketbase';

interface NavItem {
    id: string;
    label: string;
    icon: React.ElementType;
    adminOnly?: boolean;
    /** If set, item only shows for these station types (applies to operators; admins always see it) */
    stationTypes?: ('FULL_SERVICE' | 'SNACK_ONLY' | 'TIME_ONLY' | 'DINO_TREN')[];
}

interface NavSection {
    label: string;
    items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
    {
        label: 'Operaciones',
        items: [
            {
                id: 'dashboard',
                label: 'Dashboard',
                icon: LayoutDashboard,
                stationTypes: ['FULL_SERVICE', 'TIME_ONLY', 'DINO_TREN'],
            },
            {
                id: 'checkin',
                label: 'Check-in',
                icon: Users,
                stationTypes: ['FULL_SERVICE'],
            },
            {
                id: 'pos',
                label: 'Punto de Venta',
                icon: ShoppingBag,
            },
            {
                id: 'cashclose',
                label: 'Corte de Caja',
                icon: Wallet,
                stationTypes: ['FULL_SERVICE', 'TIME_ONLY', 'DINO_TREN'],
            },
        ],
    },
    {
        label: 'Gestión',
        items: [
            { id: 'inventory', label: 'Inventario', icon: ShoppingCart, adminOnly: true },
            { id: 'customers', label: 'Clientes', icon: HeartHandshake, adminOnly: true },
            { id: 'stations', label: 'Estaciones', icon: Monitor, adminOnly: true },
            { id: 'users', label: 'Usuarios', icon: UserCog, adminOnly: true },
        ],
    },
    {
        label: 'Análisis',
        items: [
            { id: 'reports', label: 'Reportes', icon: LineChart, adminOnly: true },
            { id: 'audits', label: 'Auditoría de Turnos', icon: ShieldCheck, adminOnly: true },
        ],
    },
    {
        label: 'Sistema',
        items: [
            { id: 'settings', label: 'Configuración', icon: Settings, adminOnly: true },
        ],
    },
];

interface SidebarProps {
    currentView?: string;
    onNavigate?: (view: string) => void;
    onCollapsedChange?: (collapsed: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView = 'dashboard', onNavigate, onCollapsedChange }) => {
    const [isCollapsed, setIsCollapsed] = useState(true);
    const { user, logout, setAuth } = useAuthStore();
    const { workstationType, workstationName } = useWorkstationStore();
    const isAdmin = user?.role === 'admin';

    // ── Mi Perfil modal ──
    const [showProfile, setShowProfile] = useState(false);
    const [profileName, setProfileName] = useState('');
    const [profilePassword, setProfilePassword] = useState('');
    const [profilePasswordConfirm, setProfilePasswordConfirm] = useState('');
    const [showPwd, setShowPwd] = useState(false);
    const [profileAvatarFile, setProfileAvatarFile] = useState<File | null>(null);
    const [profileAvatarPreview, setProfileAvatarPreview] = useState('');
    const [profileSaving, setProfileSaving] = useState(false);
    const [profileError, setProfileError] = useState<string | null>(null);
    const [profileSuccess, setProfileSuccess] = useState(false);

    const openProfile = () => {
        if (!user) return;
        setProfileName(user.name || '');
        setProfilePassword('');
        setProfilePasswordConfirm('');
        setProfileAvatarFile(null);
        setProfileAvatarPreview(user.avatar ? pb.files.getURL(user as any, user.avatar) : '');
        setProfileError(null);
        setProfileSuccess(false);
        setShowPwd(false);
        setShowProfile(true);
    };

    const handleProfileSave = async () => {
        if (!user) return;
        setProfileError(null);
        if (!profileName.trim()) { setProfileError('El nombre es obligatorio.'); return; }
        if (profilePassword) {
            if (profilePassword.length < 8) { setProfileError('La contraseña debe tener al menos 8 caracteres.'); return; }
            if (profilePassword !== profilePasswordConfirm) { setProfileError('Las contraseñas no coinciden.'); return; }
        }
        setProfileSaving(true);
        try {
            const fd = new FormData();
            fd.append('name', profileName.trim());
            if (profileAvatarFile) fd.append('avatar', profileAvatarFile);
            if (profilePassword) {
                fd.append('password', profilePassword);
                fd.append('passwordConfirm', profilePasswordConfirm);
            }
            const updated = await pb.collection('users').update(user.id, fd);
            setAuth({ ...user, name: updated.name, avatar: updated.avatar });
            setProfileSuccess(true);
            setTimeout(() => { setShowProfile(false); setProfileSuccess(false); }, 900);
        } catch (err: any) {
            setProfileError(err?.message || 'Error al guardar los cambios.');
        } finally {
            setProfileSaving(false);
        }
    };

    const isItemVisible = (item: NavItem): boolean => {
        if (item.adminOnly && !isAdmin) return false;
        if (!isAdmin && item.stationTypes && workstationType) {
            return item.stationTypes.includes(workstationType);
        }
        return true;
    };

    const visibleSections = NAV_SECTIONS.map(section => ({
        ...section,
        items: section.items.filter(isItemVisible),
    })).filter(section => section.items.length > 0);

    const handleMouseEnter = () => {
        setIsCollapsed(false);
        onCollapsedChange?.(false);
    };

    const handleMouseLeave = () => {
        setIsCollapsed(true);
        onCollapsedChange?.(true);
    };

    // Initials from user name
    const initials = user?.name
        ? user.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
        : (user?.email?.[0] ?? '?').toUpperCase();

    return (
        <>
        <aside
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className={cn(
                `fixed left-0 flex flex-col z-50 transition-all duration-250 ease-in-out overflow-hidden`,
                `bg-white dark:bg-slate-950`,
                `border-r border-slate-200/80 dark:border-slate-800/60`,
                'top-9 h-[calc(100vh-36px)]',
                isCollapsed ? 'w-[60px]' : 'w-[220px]'
            )}
        >
            {/* Logo / Brand */}
            <div className="h-[52px] flex items-center px-3.5 shrink-0 border-b border-slate-100 dark:border-white/[0.04] overflow-hidden">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center flex-shrink-0">
                    <div className="w-2 h-2 rounded-full bg-white/90" />
                </div>
                <span className={cn(
                    'ml-2.5 text-[13px] font-bold text-slate-800 dark:text-white tracking-tight whitespace-nowrap transition-all duration-200 leading-none',
                    isCollapsed ? 'opacity-0 w-0 ml-0' : 'opacity-100'
                )}>
                    ASTRO<span className="text-blue-500">PLAY</span>
                </span>
            </div>

            {/* Scrollable nav */}
            <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 space-y-4">
                {visibleSections.map((section) => (
                    <div key={section.label}>
                        {/* Section label — hidden when collapsed */}
                        <div className={cn(
                            'px-2 mb-1 transition-all duration-200 overflow-hidden',
                            isCollapsed ? 'h-0 opacity-0' : 'h-5 opacity-100'
                        )}>
                            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-600 whitespace-nowrap">
                                {section.label}
                            </span>
                        </div>

                        {/* Items */}
                        <div className="space-y-0.5">
                            {section.items.map((item) => {
                                const isActive = currentView === item.id;
                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => onNavigate?.(item.id)}
                                        title={isCollapsed ? item.label : undefined}
                                        className={cn(
                                            'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors duration-150 text-[13px] font-medium group',
                                            isActive
                                                ? 'bg-slate-100 dark:bg-slate-800/80 text-slate-900 dark:text-white'
                                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40 hover:text-slate-800 dark:hover:text-slate-200'
                                        )}
                                    >
                                        <item.icon className={cn(
                                            'w-[18px] h-[18px] flex-shrink-0 transition-colors duration-150',
                                            isActive
                                                ? 'text-blue-600 dark:text-blue-400'
                                                : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-400'
                                        )} />
                                        <span className={cn(
                                            'whitespace-nowrap transition-all duration-200 overflow-hidden',
                                            isCollapsed ? 'opacity-0 w-0' : 'opacity-100'
                                        )}>
                                            {item.label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>

            {/* Footer — user info + logout */}
            <div className="shrink-0 border-t border-slate-100 dark:border-white/[0.04] p-2">
                {/* User card — clickable to open Mi Perfil */}
                <button
                    onClick={openProfile}
                    title={isCollapsed ? `${user?.name || user?.email} — Mi Perfil` : 'Mi Perfil'}
                    className={cn(
                        'w-full flex items-center gap-2.5 px-2 py-2 rounded-lg overflow-hidden transition-colors duration-150',
                        'hover:bg-slate-100 dark:hover:bg-slate-800/50',
                        isCollapsed ? 'justify-center' : ''
                    )}
                >
                    {/* Avatar */}
                    {user?.avatar ? (
                        <img
                            src={pb.files.getURL(user as any, user.avatar)}
                            alt={user.name}
                            className="w-7 h-7 rounded-full object-cover flex-shrink-0 ring-1 ring-blue-200 dark:ring-blue-500/30"
                        />
                    ) : (
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center flex-shrink-0 text-white text-[11px] font-bold">
                            {initials}
                        </div>
                    )}
                    {/* Name + role */}
                    <div className={cn(
                        'flex flex-col min-w-0 transition-all duration-200 overflow-hidden text-left',
                        isCollapsed ? 'opacity-0 w-0' : 'opacity-100 flex-1'
                    )}>
                        <span className="text-[12px] font-semibold text-slate-800 dark:text-slate-200 truncate leading-tight">
                            {user?.name || user?.email}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-600 truncate leading-tight mt-px">
                            {isAdmin ? 'Administrador' : workstationName || 'Operador'}
                        </span>
                    </div>
                </button>

                {/* Logout */}
                <button
                    onClick={logout}
                    title={isCollapsed ? 'Cerrar Sesión' : undefined}
                    className={cn(
                        'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors duration-150',
                        'text-slate-500 dark:text-slate-500 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400',
                        isCollapsed ? 'justify-center' : ''
                    )}
                >
                    <LogOut className="w-[18px] h-[18px] flex-shrink-0" />
                    <span className={cn(
                        'whitespace-nowrap transition-all duration-200 overflow-hidden',
                        isCollapsed ? 'opacity-0 w-0' : 'opacity-100'
                    )}>
                        Cerrar Sesión
                    </span>
                </button>
            </div>
        </aside>

        {/* ── Mi Perfil Modal ── */}
        {showProfile && (
            <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
                <div className="w-full max-w-[420px] bg-white dark:bg-slate-900 rounded-[24px] shadow-2xl overflow-hidden animate-in zoom-in-95">

                    {/* Header */}
                    <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <h3 className="text-base font-black text-slate-900 dark:text-white">Mi Perfil</h3>
                        <button
                            onClick={() => setShowProfile(false)}
                            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="p-5 space-y-4">

                        {/* Avatar */}
                        <div className="flex items-center gap-4">
                            <div className="relative group cursor-pointer">
                                {profileAvatarPreview ? (
                                    <img src={profileAvatarPreview} alt="avatar" className="w-14 h-14 rounded-full object-cover ring-2 ring-blue-200 dark:ring-blue-500/30" />
                                ) : (
                                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center font-bold text-white text-lg">
                                        {(profileName || user?.name || '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()}
                                    </div>
                                )}
                                <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                    <Camera className="w-4 h-4 text-white" />
                                    <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) { setProfileAvatarFile(file); setProfileAvatarPreview(URL.createObjectURL(file)); }
                                    }} />
                                </label>
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{profileName || user?.name}</p>
                                <p className="text-xs text-slate-400 mt-0.5">{isAdmin ? 'Administrador' : 'Operador'}</p>
                            </div>
                        </div>

                        {/* Name */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Nombre</label>
                            <input
                                type="text"
                                value={profileName}
                                onChange={e => setProfileName(e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors text-sm"
                            />
                        </div>

                        {/* Email (read-only) */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Correo</label>
                            <input
                                type="email"
                                value={user?.email || ''}
                                disabled
                                className="w-full px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-400 dark:text-slate-500 text-sm cursor-not-allowed"
                            />
                        </div>

                        {/* New password */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Nueva contraseña <span className="normal-case font-normal">(opcional)</span></label>
                            <div className="relative">
                                <input
                                    type={showPwd ? 'text' : 'password'}
                                    value={profilePassword}
                                    onChange={e => setProfilePassword(e.target.value)}
                                    placeholder="Dejar vacío para no cambiar"
                                    className="w-full px-3.5 py-2.5 pr-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors text-sm"
                                />
                                <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {profilePassword && (
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Confirmar contraseña</label>
                                <input
                                    type={showPwd ? 'text' : 'password'}
                                    value={profilePasswordConfirm}
                                    onChange={e => setProfilePasswordConfirm(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleProfileSave()}
                                    placeholder="Repite la contraseña"
                                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors text-sm"
                                />
                            </div>
                        )}

                        {profileError && (
                            <p className="text-sm text-red-500 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl px-3.5 py-2.5">{profileError}</p>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-5 pb-5 flex gap-3">
                        <button
                            onClick={() => setShowProfile(false)}
                            className="flex-1 h-10 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition text-sm"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleProfileSave}
                            disabled={profileSaving || profileSuccess}
                            className="flex-1 h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
                        >
                            {profileSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : profileSuccess ? <Check className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                            {profileSuccess ? '¡Guardado!' : 'Guardar'}
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
};

export default Sidebar;
