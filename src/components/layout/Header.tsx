import { useState, useEffect } from 'react';
import { Bell, Clock, User as UserIcon, Sun, Moon } from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';
import { useUIStore } from '../../store/ui.store';
import { useThemeStore } from '../../store/theme.store';

interface HeaderProps {
    isCollapsed?: boolean;
}

const Header = ({ isCollapsed = false }: HeaderProps) => {
    const { user } = useAuthStore();
    const { isFullscreen } = useUIStore();
    const { theme, toggleTheme } = useThemeStore();
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <header
            className={`fixed ${isFullscreen ? 'top-0' : 'top-9'} right-0 h-20 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/50 flex items-center justify-between px-8 z-40 transition-all duration-300`}
            style={{ left: isCollapsed ? 64 : 256 }}
        >
            {/* Left: Digital Clock */}
            <div className="flex items-center gap-3 text-slate-400">
                <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                    <Clock className="w-5 h-5 text-blue-500" />
                </div>
                <div className="font-mono text-xl font-bold tracking-widest text-slate-200">
                    {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                    <span className="animate-pulse text-slate-600">:</span>
                    <span className="text-base text-slate-500">{time.toLocaleTimeString([], { second: '2-digit' })}</span>
                </div>
            </div>

            {/* Right: Notifications, Theme & Profile */}
            <div className="flex items-center gap-6">

                {/* Theme Toggle */}
                <button
                    onClick={toggleTheme}
                    className="p-2 text-slate-400 hover:text-cyan-400 bg-slate-900/50 hover:bg-slate-800 rounded-lg border border-white/5 transition-all"
                    title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                >
                    {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>

                {/* Notifications */}
                <button className="relative p-2 text-slate-400 hover:text-white transition-colors group">
                    <Bell className="w-6 h-6" />
                    <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-slate-950 group-hover:scale-110 transition-transform"></span>
                </button>

                <div className="h-8 w-px bg-slate-800"></div>

                {/* Profile */}
                <div className="flex items-center gap-4 pl-2">
                    <div className="text-right hidden sm:block">
                        <p className="text-sm font-semibold text-slate-200">{user?.name || 'Usuario'}</p>
                        <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">{user?.role || 'OPERADOR'}</p>
                    </div>
                    <div className="relative group cursor-pointer">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 p-[2px] shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-all">
                            <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center">
                                {/* Placeholder Avatar or User Icon */}
                                <UserIcon className="w-5 h-5 text-blue-200" />
                            </div>
                        </div>
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-slate-950"></div>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
