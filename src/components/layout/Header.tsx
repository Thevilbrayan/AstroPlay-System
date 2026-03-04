import { useState, useEffect } from 'react';
import { Bell, Clock, Sun, Moon } from 'lucide-react';
import { useUIStore } from '../../store/ui.store';
import { useThemeStore } from '../../store/theme.store';

interface HeaderProps {
    isCollapsed?: boolean;
}

const Header = ({ isCollapsed = false }: HeaderProps) => {
    const { isFullscreen } = useUIStore();
    const { theme, toggleTheme } = useThemeStore();
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <header
            className={`fixed ${isFullscreen ? 'top-0' : 'top-9'} right-0 h-20 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between px-8 z-40 transition-all duration-300`}
            style={{ left: isCollapsed ? 60 : 220 }}
        >
            {/* Left: Digital Clock */}
            <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
                <div className="p-2 bg-slate-100 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                    <Clock className="w-5 h-5 text-blue-600 dark:text-blue-500" />
                </div>
                <div className="font-mono text-xl font-bold tracking-widest text-slate-800 dark:text-slate-200">
                    {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                    <span className="animate-pulse text-slate-400 dark:text-slate-600">:</span>
                    <span className="text-base text-slate-500">{time.toLocaleTimeString([], { second: '2-digit' })}</span>
                </div>
            </div>

            {/* Right: Theme toggle + Notifications */}
            <div className="flex items-center gap-3">
                <button
                    onClick={toggleTheme}
                    className="p-2 text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 bg-slate-100 dark:bg-slate-900/50 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg border border-slate-200 dark:border-white/5 transition-all"
                    title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                >
                    {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>

                <button className="relative p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors group">
                    <Bell className="w-5 h-5" />
                    <span className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full border-2 border-white dark:border-slate-950"></span>
                </button>
            </div>
        </header>
    );
};

export default Header;
