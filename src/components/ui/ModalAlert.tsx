import React from 'react';
import { AlertCircle, CheckCircle2, Info, XCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type AlertType = 'success' | 'error' | 'warning' | 'info';

interface ModalAlertProps {
    isOpen: boolean;
    type: AlertType;
    title: string;
    message: string;
    onClose: () => void;
    onConfirm?: () => void;
    confirmText?: string;
    cancelText?: string;
}

const ModalAlert: React.FC<ModalAlertProps> = ({ isOpen, type, title, message, onClose, onConfirm, confirmText = 'Entendido', cancelText = 'Cancelar' }) => {
    if (!isOpen) return null;

    const getIcon = () => {
        switch (type) {
            case 'success': return <CheckCircle2 className="w-12 h-12 text-emerald-500" />;
            case 'error': return <XCircle className="w-12 h-12 text-red-500" />;
            case 'warning': return <AlertCircle className="w-12 h-12 text-amber-500" />;
            case 'info': return <Info className="w-12 h-12 text-blue-500" />;
        }
    };

    const getColors = () => {
        switch (type) {
            case 'success': return 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20';
            case 'error': return 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20';
            case 'warning': return 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20';
            case 'info': return 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20';
        }
    };

    const getButtonVariant = () => {
        switch (type) {
            case 'success': return 'default';
            case 'error': return 'destructive';
            case 'warning': return 'secondary';
            case 'info': return 'default';
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className={`relative bg-white dark:bg-slate-900 border ${getColors()} rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95`}>
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="p-6 text-center flex flex-col items-center">
                    <div className="mb-4">
                        {getIcon()}
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">{title}</h3>
                    <p className="text-slate-600 dark:text-slate-400 mb-6">{message}</p>

                    {onConfirm ? (
                        <div className="flex gap-3 w-full">
                            <Button
                                variant="outline"
                                className="flex-1 h-12 text-base"
                                onClick={onClose}
                            >
                                {cancelText}
                            </Button>
                            <Button
                                variant={getButtonVariant()}
                                className="flex-1 h-12 text-base"
                                onClick={onConfirm}
                            >
                                {confirmText}
                            </Button>
                        </div>
                    ) : (
                        <Button
                            variant={getButtonVariant()}
                            className="w-full h-12 text-base"
                            onClick={onClose}
                        >
                            {confirmText}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ModalAlert;
