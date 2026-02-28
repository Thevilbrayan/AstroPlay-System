import React, { useState } from 'react';
import { Edit3 } from 'lucide-react';
import { Product } from '../../types';
import Button from '../ui/Button';

interface ServicePriceModalProps {
    isOpen: boolean;
    product: Product | null;
    onConfirm: (product: Product, price: number) => void;
    onClose: () => void;
}

const ServicePriceModal: React.FC<ServicePriceModalProps> = ({ isOpen, product, onConfirm, onClose }) => {
    const [customPrice, setCustomPrice] = useState('');

    if (!isOpen || !product) return null;

    const handleConfirm = () => {
        const price = parseFloat(customPrice);
        if (price > 0) {
            onConfirm(product, price);
            setCustomPrice('');
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xl p-4">
            <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200 dark:border-white/10 w-full max-w-sm rounded-2xl shadow-2xl p-6 ring-1 ring-slate-200 dark:ring-white/10 animate-in fade-in zoom-in duration-200">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-blue-50 dark:bg-blue-500/10 rounded-xl text-blue-600 dark:text-blue-500">
                        <Edit3 className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Servicio Abierto</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{product.name}</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Ingresa el Monto</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                            <input
                                type="number"
                                autoFocus
                                value={customPrice}
                                onChange={(e) => setCustomPrice(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && customPrice && parseFloat(customPrice) > 0) {
                                        handleConfirm();
                                    }
                                }}
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl py-3 pl-8 pr-4 text-lg font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                placeholder="0.00"
                            />
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <Button
                            variant="ghost"
                            onClick={() => { setCustomPrice(''); onClose(); }}
                            className="flex-1 border border-slate-200 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                        >
                            Cancelar
                        </Button>
                        <Button
                            variant="primary"
                            disabled={!customPrice || parseFloat(customPrice) <= 0}
                            onClick={handleConfirm}
                            className="flex-1"
                        >
                            Confirmar
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ServicePriceModal;
