import React from 'react';
import { Pause, Play, Plus, Trash2, CheckSquare, Clock } from 'lucide-react';
import { Button } from '../ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Session } from '../../types';

export interface SessionActionBarProps {
    session: Session;
    isPaused: boolean;
    onPauseToggle: () => void;
    onExtend: (minutes: number) => void;
    onCancel: () => void;
    onFinish: () => void;
}

const SessionActionBar: React.FC<SessionActionBarProps> = ({
    isPaused,
    onPauseToggle,
    onExtend,
    onCancel,
    onFinish
}) => {
    return (
        <div className="flex items-center justify-between gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/50">
            {/* PAUSE / PLAY */}
            <Button
                variant={isPaused ? "default" : "outline"}
                size="icon"
                className={`flex-1 h-12 rounded-xl transition-all duration-200 active:scale-95 ${isPaused
                    ? 'bg-amber-500 hover:bg-amber-600 text-white border-transparent'
                    : 'border-amber-200 text-amber-600 hover:bg-amber-50 hover:text-amber-700 dark:border-amber-900/50 dark:text-amber-500 dark:hover:bg-amber-950/30'
                    }`}
                onClick={(e) => {
                    e.stopPropagation();
                    if (navigator.vibrate) navigator.vibrate(50);
                    onPauseToggle();
                }}
                title={isPaused ? "Reanudar Sesión" : "Pausar Sesión"}
            >
                {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
            </Button>

            {/* EXTEND TIME */}
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        size="icon"
                        className="flex-1 h-12 rounded-xl border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:border-blue-900/50 dark:text-blue-500 dark:hover:bg-blue-950/30 transition-all duration-200 active:scale-95"
                        onClick={(e) => {
                            e.stopPropagation();
                            if (navigator.vibrate) navigator.vibrate(50);
                        }}
                        title="Extender Tiempo"
                    >
                        <Plus className="w-5 h-5" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl" align="center" side="top" sideOffset={10}>
                    <div className="flex flex-col gap-1">
                        <p className="text-xs font-bold text-slate-500 text-center mb-1">Agregar Tiempo</p>
                        <Button variant="ghost" className="justify-start hover:bg-blue-50 hover:text-blue-600 font-semibold" onClick={() => onExtend(15)}>
                            <Clock className="w-4 h-4 mr-2 text-blue-500" /> +15 Minutos
                        </Button>
                        <Button variant="ghost" className="justify-start hover:bg-blue-50 hover:text-blue-600 font-semibold" onClick={() => onExtend(30)}>
                            <Clock className="w-4 h-4 mr-2 text-blue-500" /> +30 Minutos
                        </Button>
                        <Button variant="ghost" className="justify-start hover:bg-blue-50 hover:text-blue-600 font-semibold" onClick={() => onExtend(60)}>
                            <Clock className="w-4 h-4 mr-2 text-blue-500" /> +60 Minutos
                        </Button>
                        <div className="h-px bg-slate-100 dark:bg-slate-800 my-1"></div>
                        <Button variant="ghost" className="justify-start hover:bg-emerald-50 hover:text-emerald-600 font-semibold text-emerald-600" onClick={() => onExtend(0)}>
                            Tiempo Libre
                        </Button>
                    </div>
                </PopoverContent>
            </Popover>

            {/* CANCEL */}
            <Button
                variant="outline"
                size="icon"
                className="flex-1 h-12 rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900/50 dark:text-red-500 dark:hover:bg-red-950/30 transition-all duration-200 active:scale-95"
                onClick={(e) => {
                    e.stopPropagation();
                    if (navigator.vibrate) navigator.vibrate([50, 50]); // Double vibrate for destructive 
                    onCancel();
                }}
                title="Cancelar Sesión"
            >
                <Trash2 className="w-5 h-5" />
            </Button>

            {/* FINISH */}
            <Button
                variant="default"
                size="icon"
                className="flex-1 h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20 shadow-lg transition-all duration-200 active:scale-95"
                onClick={(e) => {
                    e.stopPropagation();
                    if (navigator.vibrate) navigator.vibrate(50);
                    onFinish();
                }}
                title="Finalizar y Cobrar"
            >
                <CheckSquare className="w-5 h-5" />
            </Button>
        </div>
    );
};

export default SessionActionBar;
