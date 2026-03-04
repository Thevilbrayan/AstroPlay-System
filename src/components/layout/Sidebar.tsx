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
} from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';
import { useWorkstationStore } from '../../store/workstation.store';
import { cn } from '../../lib/utils';
import { useUIStore } from '../../store/ui.store';

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
    const { user, logout } = useAuthStore();
    const { workstationType, workstationName } = useWorkstationStore();
    const { isFullscreen } = useUIStore();

    const isAdmin = user?.role === 'admin';

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
        <aside
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className={cn(
                `fixed left-0 flex flex-col z-50 transition-all duration-250 ease-in-out overflow-hidden`,
                `bg-white dark:bg-slate-950`,
                `border-r border-slate-200/80 dark:border-slate-800/60`,
                isFullscreen ? 'top-0 h-screen' : 'top-9 h-[calc(100vh-36px)]',
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
                {/* User card */}
                <div className={cn(
                    'flex items-center gap-2.5 px-2 py-2 rounded-lg overflow-hidden',
                    isCollapsed ? 'justify-center' : ''
                )}>
                    {/* Avatar */}
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center flex-shrink-0 text-white text-[11px] font-bold">
                        {initials}
                    </div>
                    {/* Name + station */}
                    <div className={cn(
                        'flex flex-col min-w-0 transition-all duration-200 overflow-hidden',
                        isCollapsed ? 'opacity-0 w-0' : 'opacity-100 flex-1'
                    )}>
                        <span className="text-[12px] font-semibold text-slate-800 dark:text-slate-200 truncate leading-tight">
                            {user?.name || user?.email}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-600 truncate leading-tight mt-px">
                            {isAdmin ? 'Administrador' : workstationName || 'Operador'}
                        </span>
                    </div>
                </div>

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
    );
};

export default Sidebar;
