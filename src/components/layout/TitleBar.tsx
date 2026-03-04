import { useState, useEffect } from 'react';
import { Minus, Square, X, Copy } from 'lucide-react';

const isTauri = typeof (window as any).__TAURI_INTERNALS__ !== 'undefined';

export function TitleBar() {
    const [isMaximized, setIsMaximized] = useState(false);

    useEffect(() => {
        if (!isTauri) return;

        let unlisten: (() => void) | undefined;

        const setup = async () => {
            const { getCurrentWindow } = await import('@tauri-apps/api/window');
            const appWindow = getCurrentWindow();
            setIsMaximized(await appWindow.isMaximized());
            unlisten = await appWindow.onResized(async () => {
                setIsMaximized(await appWindow.isMaximized());
            });
        };
        setup();

        return () => { unlisten?.(); };
    }, []);

    const handleMinimize = async () => {
        if (!isTauri) return;
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        getCurrentWindow().minimize();
    };

    const handleMaximize = async () => {
        if (!isTauri) return;
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const w = getCurrentWindow();
        if (isMaximized) { await w.unmaximize(); setIsMaximized(false); }
        else { await w.maximize(); setIsMaximized(true); }
    };

    const handleClose = async () => {
        if (!isTauri) return;
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        getCurrentWindow().close();
    };

    if (!isTauri) return null;

    return (
        <div
            className="fixed top-0 left-0 right-0 z-[100] flex items-center h-9 bg-white dark:bg-slate-950 border-b border-slate-200/60 dark:border-slate-800/60 select-none"
            data-tauri-drag-region
        >
            {/* Left: Branding */}
            <div className="flex items-center gap-2 px-4 shrink-0 h-full" data-tauri-drag-region>
                <div className="w-4 h-4 rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center pointer-events-none">
                    <div className="w-1.5 h-1.5 rounded-full bg-white/90" />
                </div>
                <span className="text-[11px] font-semibold tracking-[0.15em] text-slate-700 dark:text-slate-300 uppercase pointer-events-none">
                    AstroPlay OS
                </span>
            </div>

            {/* Center drag region */}
            <div className="flex-1 h-full" data-tauri-drag-region />

            {/* Right: Window controls — Windows style */}
            <div className="flex items-center h-full shrink-0">
                <button onClick={handleMinimize} title="Minimizar"
                    className="flex items-center justify-center w-11 h-full text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-slate-800/70 transition-colors duration-150 cursor-default">
                    <Minus className="w-3.5 h-3.5" />
                </button>
                <button onClick={handleMaximize} title={isMaximized ? 'Restaurar' : 'Maximizar'}
                    className="flex items-center justify-center w-11 h-full text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-slate-800/70 transition-colors duration-150 cursor-default">
                    {isMaximized ? <Copy className="w-3 h-3" /> : <Square className="w-3 h-3" />}
                </button>
                <button onClick={handleClose} title="Cerrar"
                    className="flex items-center justify-center w-12 h-full text-slate-500 dark:text-slate-400 hover:text-white dark:hover:text-white hover:bg-red-500 dark:hover:bg-red-600 transition-colors duration-150 cursor-default">
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
}
