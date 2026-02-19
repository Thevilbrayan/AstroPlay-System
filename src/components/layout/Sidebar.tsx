
import { Rocket, LayoutDashboard, UserPlus, ShieldCheck, Box, Settings, LogOut } from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';
import { cn } from '../../lib/utils';
// import { Link, useLocation } from 'react-router-dom'; // Assuming no router yet based on request, using buttons/mock

interface SidebarProps {
    currentView?: string;
    onNavigate?: (view: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView = 'dashboard', onNavigate }) => {
    const { logout } = useAuthStore();

    const menuItems = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'checkin', label: 'Check-in', icon: UserPlus },
        { id: 'security', label: 'Seguridad', icon: ShieldCheck },
        { id: 'inventory', label: 'Inventario', icon: Box },
        { id: 'settings', label: 'Configuración', icon: Settings },
    ];

    return (
        <aside className="fixed top-0 left-0 h-screen w-64 bg-slate-950 border-r border-slate-800/50 flex flex-col z-50">
            {/* Logo */}
            <div className="h-20 flex items-center px-8 border-b border-white/5">
                <Rocket className="w-6 h-6 text-blue-500 mr-3" />
                <h1 className="text-lg font-bold text-white tracking-tight">
                    ASTROPLAY <span className="text-blue-500">OS</span>
                </h1>
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-6 px-4 space-y-2 overflow-y-auto">
                {menuItems.map((item) => {
                    const isActive = currentView === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => onNavigate?.(item.id)}
                            className={cn(
                                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group text-sm font-medium",
                                isActive
                                    ? "bg-blue-600 text-white shadow-lg shadow-blue-500/25"
                                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                            )}
                        >
                            <item.icon className={cn("w-5 h-5", isActive ? "text-white" : "text-slate-500 group-hover:text-slate-300")} />
                            {item.label}
                        </button>
                    )
                })}
            </nav>

            {/* Footer / Logout */}
            <div className="p-4 border-t border-white/5">
                <button
                    onClick={logout}
                    className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all border border-transparent hover:border-red-500/20"
                >
                    <LogOut className="w-5 h-5" />
                    Cerrar Sesión
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
