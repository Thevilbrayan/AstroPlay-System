
import React, { useState } from 'react';
import { Rocket, LayoutDashboard, UserPlus, ShieldCheck, Box, Settings, LogOut } from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';
import { cn } from '../../lib/utils';
import { useUIStore } from '../../store/ui.store';

interface SidebarProps {
    currentView?: string;
    onNavigate?: (view: string) => void;
    onCollapsedChange?: (collapsed: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView = 'dashboard', onNavigate, onCollapsedChange }) => {
    const { logout } = useAuthStore();
    const [isCollapsed, setIsCollapsed] = useState(true);
    const { isFullscreen } = useUIStore();

    const menuItems = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'checkin', label: 'Check-in', icon: UserPlus },
        { id: 'security', label: 'Seguridad', icon: ShieldCheck },
        { id: 'inventory', label: 'Inventario', icon: Box },
        { id: 'settings', label: 'Configuración', icon: Settings },
    ];

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
                `fixed ${isFullscreen ? 'top-0 h-screen' : 'top-9 h-[calc(100vh-36px)]'} left-0 bg-slate-950 border-r border-slate-800/50 flex flex-col z-50 transition-all duration-300 ease-in-out overflow-hidden`,
                isCollapsed ? 'w-16' : 'w-64'
            )}
        >
            {/* Logo */}
            <div className="h-20 flex items-center px-4 border-b border-white/5 overflow-hidden">
                <Rocket className="w-6 h-6 text-blue-500 flex-shrink-0" />
                <span
                    className={cn(
                        'ml-3 text-lg font-bold text-white tracking-tight whitespace-nowrap transition-all duration-200',
                        isCollapsed ? 'opacity-0 w-0 ml-0' : 'opacity-100'
                    )}
                >
                    ASTROPLAY <span className="text-blue-500">OS</span>
                </span>
            </div>

            {/* Navigation */}
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
                                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                            )}
                        >
                            <item.icon className={cn('w-5 h-5 flex-shrink-0', isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-300')} />
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

            {/* Footer / Logout */}
            <div className="p-2 border-t border-white/5">
                <button
                    onClick={logout}
                    title={isCollapsed ? 'Cerrar Sesión' : undefined}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all border border-transparent hover:border-red-500/20"
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
