import React, { useState, useEffect } from 'react';
import { Settings, X, Save, RefreshCw, AlertTriangle, Package, Zap, Edit3, Image as ImageIcon } from 'lucide-react';
import { Product } from '../../types';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { pb } from '../../lib/pocketbase';
import { ClientResponseError } from 'pocketbase';

interface ProductFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    editingProduct: Product | null;
    onSaved: () => void;
    categories: string[];
}

const ProductFormModal: React.FC<ProductFormModalProps> = ({ isOpen, onClose, editingProduct, onSaved, categories }) => {
    const [type, setType] = useState<'physical' | 'service_fixed' | 'service_open'>('physical');
    const [name, setName] = useState('');
    const [price, setPrice] = useState('0');
    const [stock, setStock] = useState('0');
    const [minStock, setMinStock] = useState('5');
    const [cost, setCost] = useState('');
    const [category, setCategory] = useState(categories[0] || 'Snacks');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState('');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isLoadingSave, setIsLoadingSave] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (editingProduct) {
                setType(editingProduct.type || 'physical');
                setName(editingProduct.name);
                setPrice(editingProduct.price.toString());
                setStock(editingProduct.stock.toString());
                setMinStock(editingProduct.min_stock?.toString() || '5');
                setCost(editingProduct.cost?.toString() || '');
                setCategory(editingProduct.category);
                setPreviewUrl(editingProduct.imagen);
                setImageFile(null);
            } else {
                handleClearForm();
            }
            setErrorMessage(null);
        }
    }, [isOpen, editingProduct]);

    const handleClearForm = () => {
        setType('physical');
        setName('');
        setPrice('0');
        setStock('0');
        setMinStock('5');
        setCost('');
        setCategory(categories[0] || 'Snacks');
        setImageFile(null);
        setPreviewUrl('');
        setErrorMessage(null);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleSave = async () => {
        setIsLoadingSave(true);
        setErrorMessage(null);
        try {
            const formData = new FormData();
            formData.append('type', type);
            formData.append('name', name);
            formData.append('price', price);
            formData.append('stock', type === 'physical' ? stock : '0');
            formData.append('min_stock', type === 'physical' ? (minStock || '0') : '0');
            formData.append('category', category);

            if (cost) formData.append('cost', cost);
            if (imageFile) formData.append('imagen', imageFile);

            if (editingProduct) {
                await pb.collection('products').update(editingProduct.id, formData);
            } else {
                await pb.collection('products').create(formData);
            }

            onSaved();
            onClose();
        } catch (error: any) {
            console.error("Error saving product:", error);
            if (error instanceof ClientResponseError) {
                const data = error.response.data;
                let msg = error.message;
                if (data) {
                    const firstKey = Object.keys(data)[0];
                    if (firstKey) msg = `${firstKey}: ${data[firstKey].message}`;
                }
                setErrorMessage(msg);
            } else {
                setErrorMessage("Error desconocido al guardar.");
            }
        } finally {
            setIsLoadingSave(false);
        }
    };

    if (!isOpen) return null;

    const typeOptions = [
        { value: 'physical' as const, label: 'Físico', icon: Package },
        { value: 'service_fixed' as const, label: 'Serv. Fijo', icon: Zap },
        { value: 'service_open' as const, label: 'Serv. Abierto', icon: Edit3 },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xl p-4">
            <div className="bg-slate-900/90 backdrop-blur-xl border border-white/10 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 ring-1 ring-white/10">
                {/* Header */}
                <div className="p-5 border-b border-white/5 flex justify-between items-center bg-slate-900/50">
                    <div className="flex items-center gap-2">
                        <span className="p-2 bg-blue-500/10 rounded-lg text-blue-500 border border-blue-500/20">
                            <Settings className="w-5 h-5" />
                        </span>
                        <h3 className="text-lg font-bold text-slate-100">
                            {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
                        </h3>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    {errorMessage && (
                        <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <h4 className="text-sm font-bold text-red-400">Error al guardar</h4>
                                <p className="text-xs text-red-300 mt-1">{errorMessage}</p>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-6">
                            {/* Type Selector */}
                            <div className="grid grid-cols-3 gap-2 bg-slate-950/50 p-1 rounded-xl border border-white/5">
                                {typeOptions.map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setType(opt.value)}
                                        className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${type === opt.value ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                                    >
                                        <opt.icon className="w-3.5 h-3.5" />
                                        {opt.label}
                                    </button>
                                ))}
                            </div>

                            <Input
                                label="Nombre del Producto"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="Ej. Nachos Supreme"
                            />

                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    label="Precio ($)"
                                    type="number"
                                    value={price}
                                    onChange={e => setPrice(e.target.value)}
                                    placeholder="0.00"
                                    disabled={type === 'service_open'}
                                />
                                <Input
                                    label="Costo ($)"
                                    type="number"
                                    value={cost}
                                    onChange={e => setCost(e.target.value)}
                                    placeholder="Opcional"
                                />
                            </div>

                            {type === 'physical' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <Input
                                        label="Stock Actual"
                                        type="number"
                                        value={stock}
                                        onChange={e => setStock(e.target.value)}
                                        placeholder="0"
                                    />
                                    <Input
                                        label="Stock Mínimo"
                                        type="number"
                                        value={minStock}
                                        onChange={e => setMinStock(e.target.value)}
                                        placeholder="5"
                                        className="border-orange-500/30 focus-visible:ring-orange-500/20 text-orange-200"
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Categoría</label>
                                <select
                                    value={category}
                                    onChange={e => setCategory(e.target.value)}
                                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                >
                                    {categories.map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Image Upload */}
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-2">Imagen del Producto</label>
                            <div className="h-full flex flex-col gap-4">
                                <div className="flex-1 bg-slate-950/50 rounded-xl border-2 border-dashed border-slate-800 flex flex-col items-center justify-center relative overflow-hidden group hover:border-blue-500/20 transition-colors min-h-[200px]">
                                    {previewUrl ? (
                                        <>
                                            <img src={previewUrl} alt="Preview" className="w-full h-full object-contain p-4" />
                                            <button
                                                onClick={() => { setPreviewUrl(''); setImageFile(null); }}
                                                className="absolute top-2 right-2 p-2 bg-black/60 rounded-full text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-black/80"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </>
                                    ) : (
                                        <div className="text-center p-6">
                                            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                                                <ImageIcon className="w-8 h-8 text-slate-600" />
                                            </div>
                                            <p className="text-sm font-medium text-slate-400">Arrastra una imagen aquí</p>
                                            <p className="text-xs text-slate-600 mt-1">o haz click para subir</p>
                                        </div>
                                    )}
                                    <input
                                        type="file"
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        accept="image/*"
                                        onChange={handleFileChange}
                                    />
                                </div>
                                <p className="text-xs text-center text-slate-500">Recomendado: 500x500px, PNG o JPG</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-white/5 bg-slate-950/50 flex items-center justify-between">
                    <button
                        onClick={handleClearForm}
                        className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-500 hover:text-white transition-colors hover:bg-white/5 rounded-lg"
                        title="Limpiar Formulario"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Limpiar</span>
                    </button>
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" onClick={onClose} className="border border-white/5 hover:bg-white/5 text-slate-400 hover:text-white">
                            Cancelar
                        </Button>
                        <Button
                            variant="primary"
                            isLoading={isLoadingSave}
                            onClick={handleSave}
                            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 border-none shadow-lg shadow-blue-500/20 text-white"
                            icon={!isLoadingSave && <Save className="w-4 h-4" />}
                        >
                            Guardar Producto
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProductFormModal;
