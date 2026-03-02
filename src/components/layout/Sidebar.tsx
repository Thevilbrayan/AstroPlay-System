import React, { useState } from 'react';
import {
    LayoutDashboard,
    Users,
    ShoppingCart,
    Settings,
    LogOut,
    Monitor,
    Wrench,
    ShoppingBag,
    LineChart,
    Wallet,
    ShieldCheck
} from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';
import { useWorkstationStore } from '../../store/workstation.store';
import { cn } from '../../lib/utils';
import { useUIStore } from '../../store/ui.store';

interface SidebarProps {
    currentView?: string;
    onNavigate?: (view: string) => void;
    onCollapsedChange?: (collapsed: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView = 'dashboard', onNavigate, onCollapsedChange }) => {
    const [isCollapsed, setIsCollapsed] = useState(true);
    const { user, logout } = useAuthStore();
    const { workstationType } = useWorkstationStore();
    const { isFullscreen } = useUIStore();

    const menuItems = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'reports', label: 'Reportes & BI', icon: LineChart },
        { id: 'checkin', label: 'Check-in', icon: Users },
        { id: 'pos', label: 'Punto de Venta', icon: ShoppingBag },
        { id: 'inventory', label: 'Inventario', icon: ShoppingCart },
        { id: 'cashclose', label: 'Corte de Caja', icon: Wallet },
        { id: 'audits', label: 'Auditoría Cajas', icon: ShieldCheck },
    ].filter(item => {
        // SNACK_ONLY workstations only need POS, plus Inventory if admin
        if (workstationType === 'SNACK_ONLY') {
            if (user?.role === 'admin') return item.id === 'pos' || item.id === 'inventory';
            return item.id === 'pos';
        }

        // TIME_ONLY workstations need dashboard and POS
        if (workstationType === 'TIME_ONLY') {
            return item.id === 'dashboard' || item.id === 'pos';
        }

        // FULL_SERVICE: Show everything, but restrict inventory, reports, and audits to admin
        if (user?.role !== 'admin' && (item.id === 'inventory' || item.id === 'reports' || item.id === 'audits')) return false;

        return true;
    });

    const handleMouseEnter = () => {
        setIsCollapsed(false);
        onCollapsedChange?.(false);
    };

    const handleMouseLeave = () => {
        setIsCollapsed(true);
        onCollapsedChange?.(true);
    };

    return (
        <aside
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className={cn(
                `fixed ${isFullscreen ? 'top-0 h-screen' : 'top-9 h-[calc(100vh-36px)]'} left-0 bg-white dark:bg-slate-950 border-r border-gray-200 dark:border-slate-800/50 flex flex-col z-50 transition-all duration-300 ease-in-out overflow-hidden shadow-sm dark:shadow-none`,
                isCollapsed ? 'w-16' : 'w-64'
            )}
        >
            {/* Logo */}
            <div className="h-20 flex items-center px-4 border-b border-gray-100 dark:border-white/5 overflow-hidden shrink-0">
                <img src="/logo.png" alt="Astroplay OS Logo" className="w-6 h-6 flex-shrink-0" />
                <span
                    className={cn(
                        'ml-3 text-lg font-bold text-slate-800 dark:text-white tracking-tight whitespace-nowrap transition-all duration-200',
                        isCollapsed ? 'opacity-0 w-0 ml-0' : 'opacity-100'
                    )}
                >
                    ASTROPLAY <span className="text-blue-600 dark:text-blue-500">OS</span>
                </span>
            </div>

            {/* Navigation - Top Section */}
            <nav className="flex-1 py-6 px-2 space-y-1 overflow-y-auto overflow-x-hidden">
                {menuItems.map((item) => {
                    const isActive = currentView === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => onNavigate?.(item.id)}
                            title={isCollapsed ? item.label : undefined}
                            className={cn(
                                'w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group text-sm font-medium',
                                isActive
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-slate-200'
                            )}
                        >
                            <item.icon className={cn('w-5 h-5 flex-shrink-0', isActive ? 'text-white' : 'text-slate-500 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300')} />
                            <span
                                className={cn(
                                    'whitespace-nowrap transition-all duration-200 overflow-hidden',
                                    isCollapsed ? 'opacity-0 w-0' : 'opacity-100'
                                )}
                            >
                                {item.label}
                            </span>
                        </button>
                    );
                })}
            </nav>

            {/* Admin & Settings - Bottom Section */}
            <div className="px-2 pb-4 space-y-1 shrink-0">
                {/* Admin Settings Button */}
                {user?.role === 'admin' && (
                    <button
                        onClick={() => onNavigate?.('settings')}
                        className={cn(
                            "flex items-center w-full px-3 py-3 rounded-xl transition-all duration-300 group relative overflow-hidden text-sm",
                            currentView === 'settings'
                                ? "bg-blue-50/80 dark:bg-gradient-to-r dark:from-blue-600/20 dark:to-transparent text-blue-600 dark:text-blue-400 ring-1 ring-blue-200 dark:ring-blue-500/50"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5"
                        )}
                        title={isCollapsed ? "Configuración" : undefined}
                    >
                        <Settings className={cn(
                            "w-5 h-5 shrink-0 transition-transform duration-300",
                            currentView === 'settings' ? "text-blue-600 dark:text-blue-400 scale-110" : "text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300"
                        )} />

                        <span
                            className={cn(
                                "font-medium whitespace-nowrap ml-3 transition-all duration-300",
                                isCollapsed ? 'opacity-0 w-0' : 'opacity-100'
                            )}
                        >
                            Configuración
                        </span>
                    </button>
                )}

                {/* Admin Station Manager Button */}
                {user?.role === 'admin' && (
                    <button
                        onClick={() => onNavigate?.('stations')}
                        className={cn(
                            "flex items-center w-full px-3 py-3 rounded-xl transition-all duration-300 group relative overflow-hidden text-sm",
                            currentView === 'stations'
                                ? "bg-blue-50/80 dark:bg-gradient-to-r dark:from-blue-600/20 dark:to-transparent text-blue-600 dark:text-blue-400 ring-1 ring-blue-200 dark:ring-blue-500/50"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5"
                        )}
                        title={isCollapsed ? "Gestión de Estaciones" : undefined}
                    >
                        <Monitor className={cn(
                            "w-5 h-5 shrink-0 transition-transform duration-300",
                            currentView === 'stations' ? "text-blue-600 dark:text-blue-400 scale-110" : "text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300"
                        )} />

                        <span
                            className={cn(
                                "font-medium whitespace-nowrap ml-3 transition-all duration-300",
                                isCollapsed ? 'opacity-0 w-0' : 'opacity-100'
                            )}
                        >
                            Gestión de Estaciones
                        </span>
                    </button>
                )}

                {/* Admin Hardware Config Button */}
                {user?.role === 'admin' && (
                    <button
                        onClick={() => onNavigate?.('hardware')}
                        className={cn(
                            "flex items-center w-full px-3 py-3 rounded-xl transition-all duration-300 group relative overflow-hidden text-sm",
                            currentView === 'hardware'
                                ? "bg-blue-50/80 dark:bg-gradient-to-r dark:from-blue-600/20 dark:to-transparent text-blue-600 dark:text-blue-400 ring-1 ring-blue-200 dark:ring-blue-500/50"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5"
                        )}
                        title={isCollapsed ? "Configuración de Hardware" : undefined}
                    >
                        <Wrench className={cn(
                            "w-5 h-5 shrink-0 transition-transform duration-300",
                            currentView === 'hardware' ? "text-blue-600 dark:text-blue-400 scale-110" : "text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300"
                        )} />

                        <span
                            className={cn(
                                "font-medium whitespace-nowrap ml-3 transition-all duration-300",
                                isCollapsed ? 'opacity-0 w-0' : 'opacity-100'
                            )}
                        >
                            Configuración de Hardware
                        </span>
                    </button>
                )}
            </div>

            {/* Footer / Logout */}
            <div className="p-2 border-t border-gray-100 dark:border-white/5 shrink-0 bg-slate-50/50 dark:bg-transparent">
                <button
                    onClick={() => {
                        // Firmly decouple Logout from Workstation: Clear the Auth token, keeping lock screen!
                        logout();
                    }}
                    title={isCollapsed ? 'Cerrar Sesión' : undefined}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-300 transition-all border border-transparent hover:border-red-200 dark:hover:border-red-500/20"
                >
                    <LogOut className="w-5 h-5 flex-shrink-0" />
                    <span
                        className={cn(
                            'whitespace-nowrap transition-all duration-200 overflow-hidden',
                            isCollapsed ? 'opacity-0 w-0' : 'opacity-100'
                        )}
                    >
                        Cerrar Sesión
                    </span>
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
