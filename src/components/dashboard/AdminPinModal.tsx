import React, { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Lock, Delete } from 'lucide-react';
import { useSettingsStore } from '../../store/settings.store';

interface AdminPinModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    actionDescription?: string;
}

const AdminPinModal: React.FC<AdminPinModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    actionDescription = "Esta acción requiere autorización de administrador."
}) => {
    const { settings } = useSettingsStore();
    const ADMIN_PIN = settings?.admin_pin || '1234'; // Reads from PocketBase settings
    const [pin, setPin] = useState('');
    const [error, setError] = useState(false);

    const handleKeyPress = (num: number) => {
        if (pin.length < 4) {
            setPin(prev => prev + num);
            setError(false);
        }
    };

    const handleDelete = () => {
        setPin(prev => prev.slice(0, -1));
        setError(false);
    };

    const handleConfirm = () => {
        if (pin === ADMIN_PIN) {
            setPin('');
            setError(false);
            onSuccess();
            onClose();
        } else {
            setError(true);
            setPin('');
            if (navigator.vibrate) navigator.vibrate([100, 50, 100]); // Error vibration
        }
    };

    const handleClose = () => {
        setPin('');
        setError(false);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-0 overflow-hidden shadow-2xl rounded-2xl">

                {/* Header Profile Banner */}
                <div className="bg-slate-900 dark:bg-black p-6 flex flex-col items-center justify-center text-center border-b border-slate-800">
                    <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-3 shadow-inner ring-4 ring-slate-800/50">
                        <Lock className="w-8 h-8 text-amber-500" />
                    </div>
                    <DialogTitle className="text-xl font-bold text-white tracking-tight">
                        Autorización Requerida
                    </DialogTitle>
                    <DialogDescription className="text-slate-400 text-sm mt-1">
                        {actionDescription}
                    </DialogDescription>
                </div>

                <div className="p-6 flex flex-col items-center">

                    {/* PIN Visualizer */}
                    <div className="flex gap-4 mb-8">
                        {[0, 1, 2, 3].map((index) => (
                            <div
                                key={index}
                                className={`w-4 h-4 rounded-full transition-all duration-300 ${index < pin.length
                                    ? 'bg-amber-500 scale-110 shadow-[0_0_10px_rgba(245,158,11,0.5)]'
                                    : 'bg-slate-200 dark:bg-slate-800 scale-100'
                                    } ${error ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)] animate-shake' : ''}`}
                            />
                        ))}
                    </div>

                    {error && (
                        <p className="text-red-500 text-sm font-bold mb-4 animate-pulse">
                            PIN Incorrecto. Intenta de nuevo.
                        </p>
                    )}

                    {/* Numeric Keypad */}
                    <div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                            <Button
                                key={num}
                                variant="outline"
                                className="h-16 text-2xl font-black rounded-2xl active:scale-95 transition-transform bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
                                onClick={() => handleKeyPress(num)}
                            >
                                {num}
                            </Button>
                        ))}

                        <Button
                            variant="outline"
                            className="h-16 rounded-2xl active:scale-95 transition-transform bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-red-500 hover:text-red-600"
                            onClick={handleDelete}
                            disabled={pin.length === 0}
                        >
                            <Delete className="w-6 h-6" />
                        </Button>
                        <Button
                            variant="outline"
                            className="h-16 text-2xl font-black rounded-2xl active:scale-95 transition-transform bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
                            onClick={() => handleKeyPress(0)}
                        >
                            0
                        </Button>

                        <Button
                            variant="default"
                            className={`h-16 rounded-2xl active:scale-95 transition-transform font-bold text-lg ${pin.length === 4
                                ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20 shadow-lg'
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                                }`}
                            disabled={pin.length !== 4}
                            onClick={handleConfirm}
                        >
                            OK
                        </Button>
                    </div>

                </div>
            </DialogContent>
        </Dialog>
    );
};

export default AdminPinModal;
