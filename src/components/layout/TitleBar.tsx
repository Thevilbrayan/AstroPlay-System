import { useState, useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Minus, Square, X, Maximize2, Copy, Shrink } from 'lucide-react';
import { useUIStore } from '../../store/ui.store';

export function TitleBar() {
    const [isMaximized, setIsMaximized] = useState(false);
    const { isFullscreen, setFullscreen } = useUIStore();

    useEffect(() => {
        const appWindow = getCurrentWindow();
        appWindow.isMaximized().then(setIsMaximized);
        appWindow.isFullscreen().then(setFullscreen);

        let unlistenResize: (() => void) | undefined;
        appWindow.onResized(async () => {
            setIsMaximized(await appWindow.isMaximized());
            setFullscreen(await appWindow.isFullscreen());
        }).then((fn) => { unlistenResize = fn; });

        // F11 to toggle fullscreen
        const handleKey = async (e: KeyboardEvent) => {
            if (e.key === 'F11') {
                e.preventDefault();
                const w = getCurrentWindow();
                const current = await w.isFullscreen();
                await w.setFullscreen(!current);
                setFullscreen(!current);
            }
        };
        window.addEventListener('keydown', handleKey);

        return () => {
            unlistenResize?.();
            window.removeEventListener('keydown', handleKey);
        };
    }, []);

    const handleMinimize = () => getCurrentWindow().minimize();
    const handleMaximize = async () => {
        const w = getCurrentWindow();
        if (isMaximized) { await w.unmaximize(); setIsMaximized(false); }
        else { await w.maximize(); setIsMaximized(true); }
    };
    const handleFullscreen = async () => {
        const next = !isFullscreen;
        await getCurrentWindow().setFullscreen(next);
        setFullscreen(next);
    };
    const handleClose = () => getCurrentWindow().close();

    // In fullscreen: show a floating exit button only
    if (isFullscreen) {
        return (
            <button
                onClick={handleFullscreen}
                title="Salir de pantalla completa (F11)"
                className="fixed top-2 right-2 z-[200] flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-slate-300/50 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 backdrop-blur-sm transition-all duration-200 opacity-30 hover:opacity-100 text-xs"
            >
                <Shrink className="w-3.5 h-3.5" />
                <span>Salir (F11)</span>
            </button>
        );
    }

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

            {/* Right: Window controls */}
            <div className="flex items-center h-full shrink-0">
                <button onClick={handleFullscreen} title="Pantalla completa (F11)"
                    className="flex items-center justify-center w-10 h-full text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/70 transition-colors duration-150 cursor-default">
                    <Maximize2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={handleMinimize} title="Minimizar"
                    className="flex items-center justify-center w-10 h-full text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-slate-800/70 transition-colors duration-150 cursor-default">
                    <Minus className="w-3.5 h-3.5" />
                </button>
                <button onClick={handleMaximize} title={isMaximized ? 'Restaurar' : 'Maximizar'}
                    className="flex items-center justify-center w-10 h-full text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-slate-800/70 transition-colors duration-150 cursor-default">
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
