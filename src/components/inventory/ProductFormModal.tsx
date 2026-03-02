import React, { useState, useEffect } from 'react';
import { Settings, X, Save, RefreshCw, AlertTriangle, Package, Zap, Image as ImageIcon, Coffee } from 'lucide-react';
import { Product } from '../../types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { pb } from '../../lib/pocketbase';
import { ClientResponseError } from 'pocketbase';

interface ProductFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    editingProduct: Product | null;
    onSaved: () => void;
}

const ProductFormModal: React.FC<ProductFormModalProps> = ({ isOpen, onClose, editingProduct, onSaved }) => {
    const [category, setCategory] = useState<'service' | 'snack' | 'socks'>('service');
    const [name, setName] = useState('');
    const [price, setPrice] = useState('');
    const [durationMin, setDurationMin] = useState('60');
    const [subcategory, setSubcategory] = useState<'Bebidas' | 'Snacks' | ''>('');
    const [size, setSize] = useState<'M' | 'G' | 'L'>('M');
    const [stock, setStock] = useState('0');
    const [minStock, setMinStock] = useState('5');
    const [cost, setCost] = useState('');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState('');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isLoadingSave, setIsLoadingSave] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (editingProduct) {
                setCategory(editingProduct.category || 'service');
                setName(editingProduct.name);
                setPrice(editingProduct.price?.toString() || '');
                setDurationMin(editingProduct.duration_min?.toString() || '60');
                setSubcategory(editingProduct.subcategory || '');
                setSize(editingProduct.size || 'M');
                setStock(editingProduct.stock?.toString() || '0');
                setMinStock(editingProduct.min_stock?.toString() || '5');
                setCost(editingProduct.cost?.toString() || '');
                setPreviewUrl(editingProduct.imagen || '');
                setImageFile(null);
            } else {
                handleClearForm();
            }
            setErrorMessage(null);
        }
    }, [isOpen, editingProduct]);

    const handleClearForm = () => {
        setCategory('service');
        setName('');
        setPrice('');
        setDurationMin('60');
        setSubcategory('');
        setSize('M');
        setStock('0');
        setMinStock('5');
        setCost('');
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
            formData.append('category', category);
            formData.append('name', name);
            formData.append('price', price || '0');

            if (category === 'service') {
                formData.append('duration_min', durationMin);
                formData.append('stock', '0');
                formData.append('min_stock', '0');
            } else if (category === 'snack') {
                formData.append('subcategory', subcategory);
                formData.append('stock', stock || '0');
                formData.append('min_stock', minStock || '0');
            } else if (category === 'socks') {
                formData.append('size', size);
                formData.append('stock', stock || '0');
                formData.append('min_stock', minStock || '0');
            }

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

    const categoryOptions = [
        { value: 'service' as const, label: 'Servicio', icon: Zap },
        { value: 'snack' as const, label: 'Snack', icon: Coffee },
        { value: 'socks' as const, label: 'Calceta', icon: Package },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 dark:bg-black/60 backdrop-blur-xl p-4">
            <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200 dark:border-white/10 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 ring-1 ring-slate-200 dark:ring-white/10">
                {/* Header */}
                <div className="p-5 border-b border-slate-200 dark:border-white/5 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                    <div className="flex items-center gap-2">
                        <span className="p-2 bg-blue-50 dark:bg-blue-500/10 rounded-lg text-blue-600 dark:text-blue-500 border border-blue-200 dark:border-blue-500/20">
                            <Settings className="w-5 h-5" />
                        </span>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                            {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
                        </h3>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/5 rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    {errorMessage && (
                        <div className="mb-6 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl p-4 flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <h4 className="text-sm font-bold text-red-700 dark:text-red-400">Error al guardar</h4>
                                <p className="text-xs text-red-600 dark:text-red-300 mt-1">{errorMessage}</p>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-6">
                            {/* Category Selector */}
                            <div className="grid grid-cols-3 gap-2 bg-slate-100 dark:bg-slate-950/50 p-1 rounded-xl border border-slate-200 dark:border-white/5">
                                {categoryOptions.map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setCategory(opt.value)}
                                        className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${category === opt.value ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                                    >
                                        <opt.icon className="w-3.5 h-3.5" />
                                        {opt.label}
                                    </button>
                                ))}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <Label htmlFor="product-name" className="sr-only">Nombre del Producto</Label>
                                <Input
                                    id="product-name"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="Ej. Day Pass"
                                />
                            </div>

                            {/* Dynamic Fields */}
                            {category === 'service' && (
                                <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-1 px-1">
                                    <div className="flex flex-col gap-1.5">
                                        <Label htmlFor="duration-min">Duración (minutos)</Label>
                                        <Input
                                            id="duration-min"
                                            type="number"
                                            value={durationMin}
                                            onChange={e => setDurationMin(e.target.value)}
                                            placeholder="60"
                                        />
                                    </div>
                                    <span className="self-end pb-[11px] text-xs text-slate-500 dark:text-slate-400 italic">Dejar como 0 u 800 si es abierto</span>
                                </div>
                            )}

                            {category === 'snack' && (
                                <div className="animate-in fade-in slide-in-from-top-1 px-1">
                                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Subcategoría</label>
                                    <select
                                        value={subcategory}
                                        onChange={e => setSubcategory(e.target.value as 'Bebidas' | 'Snacks' | '')}
                                        className="w-full h-10 px-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    >
                                        <option value="">Selecciona...</option>
                                        <option value="Bebidas">Bebidas</option>
                                        <option value="Snacks">Snacks</option>
                                    </select>
                                </div>
                            )}

                            {category === 'socks' && (
                                <div className="animate-in fade-in slide-in-from-top-1 px-1">
                                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Talla</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            { val: 'M', label: 'M (Pequeña/Med)' },
                                            { val: 'G', label: 'G (Grande)' },
                                            { val: 'L', label: 'L (Extra)' }
                                        ].map(s => (
                                            <button
                                                key={s.val}
                                                onClick={() => setSize(s.val as 'M' | 'G' | 'L')}
                                                className={`py-2 rounded-lg text-xs font-bold transition-all border ${size === s.val ? 'bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/50' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/5 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'}`}
                                            >
                                                {s.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="price-val">Precio ($)</Label>
                                    <Input
                                        id="price-val"
                                        type="number"
                                        value={price}
                                        onChange={e => setPrice(e.target.value)}
                                        placeholder="0.00"
                                        disabled={false}
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="cost-val">Costo ($)</Label>
                                    <Input
                                        id="cost-val"
                                        type="number"
                                        value={cost}
                                        onChange={e => setCost(e.target.value)}
                                        placeholder="Opcional"
                                    />
                                </div>
                            </div>

                            {(category === 'snack' || category === 'socks') && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-1.5">
                                        <Label htmlFor="stock">Stock Actual</Label>
                                        <Input
                                            id="stock"
                                            type="number"
                                            value={stock}
                                            onChange={e => setStock(e.target.value)}
                                            placeholder="0"
                                        />
                                    </div>
                                    {category === 'snack' && (
                                        <div className="flex flex-col gap-1.5">
                                            <Label htmlFor="min-stock">Stock Mínimo</Label>
                                            <Input
                                                id="min-stock"
                                                type="number"
                                                value={minStock}
                                                onChange={e => setMinStock(e.target.value)}
                                                placeholder="5"
                                                className="border-orange-300 dark:border-orange-500/30 focus-visible:ring-orange-500/20 text-orange-600 dark:text-orange-200"
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Image Upload */}
                        <div>
                            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Imagen del Producto</label>
                            <div className="h-full flex flex-col gap-4">
                                <div className="flex-1 bg-slate-50 dark:bg-slate-950/50 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-800 flex flex-col items-center justify-center relative overflow-hidden group hover:border-blue-400 dark:hover:border-blue-500/20 transition-colors min-h-[200px]">
                                    {previewUrl ? (
                                        <>
                                            <img src={previewUrl} alt="Preview" className="w-full h-full object-contain p-4" />
                                            <button
                                                onClick={() => { setPreviewUrl(''); setImageFile(null); }}
                                                className="absolute top-2 right-2 p-2 bg-black/50 dark:bg-black/60 rounded-full text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-black/70 dark:hover:bg-black/80"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </>
                                    ) : (
                                        <div className="text-center p-6">
                                            <div className="w-16 h-16 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                                                <ImageIcon className="w-8 h-8 text-slate-400 dark:text-slate-600" />
                                            </div>
                                            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Arrastra una imagen aquí</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-600 mt-1">o haz click para subir</p>
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
                <div className="p-5 border-t border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-950/50 flex items-center justify-between">
                    <button
                        onClick={handleClearForm}
                        className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors hover:bg-slate-200 dark:hover:bg-white/5 rounded-lg"
                        title="Limpiar Formulario"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Limpiar</span>
                    </button>
                    <div className="flex items-center gap-3">
                        <Button variant="outline" onClick={onClose} className="border border-slate-200 dark:border-white/5 hover:bg-slate-200 dark:hover:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">
                            Cancelar
                        </Button>
                        <Button
                            disabled={isLoadingSave}
                            onClick={handleSave}
                            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 border-none shadow-lg shadow-blue-500/20 text-white"
                        >
                            {isLoadingSave ? null : <Save className="w-4 h-4 mr-2" />}
                            Guardar Producto
                        </Button>
                    </div>
                </div>
            </div>
        </div >
    );
};

export default ProductFormModal;
