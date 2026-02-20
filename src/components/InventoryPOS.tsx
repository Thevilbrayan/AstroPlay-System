
import React, { useState, useMemo, useEffect } from 'react';
import { Search, ShoppingCart, Package, Trash2, Plus, Minus, CreditCard, Banknote, Edit, Settings, X, Save, Image as ImageIcon, UploadCloud, RefreshCw, AlertTriangle } from 'lucide-react';
import { Product } from '../types';
import Button from './ui/Button';
import Input from './ui/Input';
import { useAuthStore } from '../store/auth.store';
import { pb } from '../lib/pocketbase';
import { ClientResponseError } from 'pocketbase';

interface CartItem {
    product: Product;
    quantity: number;
}

const InventoryPOS: React.FC = () => {
    const { user } = useAuthStore();
    const [products, setProducts] = useState<Product[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState('All');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
    const [isProcessing, setIsProcessing] = useState(false);

    // Admin State(State)
    const [isManaging, setIsManaging] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isLoadingSave, setIsLoadingSave] = useState(false);

    // Form State
    const [name, setName] = useState('');
    const [price, setPrice] = useState<string>('0');
    const [stock, setStock] = useState<string>('0');
    const [minStock, setMinStock] = useState<string>('5');
    const [cost, setCost] = useState<string>('');
    const [category, setCategory] = useState('Snacks');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string>('');

    // Fetch Products
    useEffect(() => {
        loadProducts();
    }, []);

    const loadProducts = async () => {
        try {
            const records = await pb.collection('products').getList<Product>(1, 50, {
                sort: '-created',
            });
            const productsWithImages = records.items.map(record => ({
                ...record,
                imagen: record.imagen ? pb.files.getUrl(record, record.imagen) : ''
            }));
            setProducts(productsWithImages);
        } catch (error) {
            console.error("Error loading products:", error);
        }
    };

    // Filter Products
    const filteredProducts = useMemo(() => {
        return products.filter(product => {
            const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesFilter = activeFilter === 'All' || product.category === activeFilter;
            return matchesSearch && matchesFilter;
        });
    }, [products, searchQuery, activeFilter]);

    // Cart Calculations
    const subtotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
    const tax = subtotal * 0.16;
    const total = subtotal + tax;

    // Cart Actions
    const addToCart = (product: Product) => {
        if (product.stock === 0) return;

        setCart(prev => {
            const existing = prev.find(item => item.product.id === product.id);
            if (existing) {
                if (existing.quantity >= product.stock) return prev;
                return prev.map(item =>
                    item.product.id === product.id
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                );
            }
            return [...prev, { product, quantity: 1 }];
        });
    };

    const removeFromCart = (productId: string) => {
        setCart(prev => prev.filter(item => item.product.id !== productId));
    };

    const updateQuantity = (productId: string, delta: number) => {
        setCart(prev => {
            return prev.map(item => {
                if (item.product.id === productId) {
                    const newQuantity = item.quantity + delta;
                    if (newQuantity <= 0) return item;
                    if (newQuantity > item.product.stock) return item;
                    return { ...item, quantity: newQuantity };
                }
                return item;
            });
        });
    };

    const handleCheckout = () => {
        setIsProcessing(true);
        setTimeout(() => {
            setIsProcessing(false);
            setCart([]);
            alert('Venta realizada con éxito!');
        }, 1500);
    };

    // Admin Actions
    const handleOpenModal = (product?: Product) => {
        setErrorMessage(null);
        if (product) {
            setEditingProduct(product);
            setName(product.name);
            setPrice(product.price.toString());
            setStock(product.stock.toString());
            setMinStock(product.min_stock?.toString() || '5');
            setCost(product.cost?.toString() || '');
            setCategory(product.category);
            setPreviewUrl(product.imagen);
            setImageFile(null);
        } else {
            handleClearForm();
            setEditingProduct(null); // Ensure null for new
        }
        setIsModalOpen(true);
    };

    const handleClearForm = () => {
        setName('');
        setPrice('0');
        setStock('0');
        setMinStock('5');
        setCost('');
        setCategory('Snacks');
        setImageFile(null);
        setPreviewUrl('');
        setErrorMessage(null);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            const url = URL.createObjectURL(file);
            setPreviewUrl(url);
        }
    };

    const handleSaveProduct = async () => {
        setIsLoadingSave(true);
        setErrorMessage(null);
        try {
            const formData = new FormData();
            formData.append('name', name);
            formData.append('price', price);
            formData.append('stock', stock); // Keeping stock as it's essential for new products
            formData.append('min_stock', minStock || '0');
            formData.append('category', category);

            if (cost) {
                formData.append('cost', cost);
            }

            // Critical: Append image file if selected
            if (imageFile) {
                formData.append('imagen', imageFile);
            }

            if (editingProduct) {
                await pb.collection('products').update(editingProduct.id, formData);
            } else {
                await pb.collection('products').create(formData);
            }
            setIsModalOpen(false);
            loadProducts();
        } catch (error: any) {
            console.error("Error saving product:", error);
            if (error instanceof ClientResponseError) {
                const data = error.response.data;
                let msg = error.message;
                // Try to extract first validation error
                if (data) {
                    const firstKey = Object.keys(data)[0];
                    if (firstKey) {
                        msg = `${firstKey}: ${data[firstKey].message}`;
                    }
                }
                setErrorMessage(msg);
            } else {
                setErrorMessage("Error desconocido al guardar.");
            }
        } finally {
            setIsLoadingSave(false);
        }
    };

    const handleDeleteProduct = async (id: string) => {
        if (confirm('¿Estás seguro de eliminar este producto?')) {
            try {
                await pb.collection('products').delete(id);
                loadProducts();
            } catch (error) {
                console.error("Error deleting product:", error);
            }
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);
    };

    const categories = ['All', 'Snacks', 'Drinks', 'Socks'];

    return (
        <div className="flex h-full gap-6 p-6 bg-slate-950 text-slate-200 font-sans relative">
            {/* Left Column: Product Gallery (70%) */}
            <div className="flex-1 flex flex-col gap-6 w-[70%]">
                {/* Search & Filters */}
                <div className="flex flex-col gap-4 sticky top-0 z-10 bg-slate-950/80 backdrop-blur-sm py-2">
                    <div className="flex items-center gap-4">
                        <div className="relative flex-1">
                            <Input
                                icon={<Search className="w-5 h-5" />}
                                placeholder="Buscar productos..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="bg-slate-900/50 border-white/10"
                            />
                        </div>
                        {user?.role === 'admin' && (
                            <button
                                onClick={() => setIsManaging(!isManaging)}
                                className={`p-3 rounded-xl border transition-all ${isManaging
                                    ? 'bg-amber-500/20 border-amber-500 text-amber-400 shadow-lg shadow-amber-500/20'
                                    : 'bg-slate-800 border-white/5 text-slate-400 hover:text-white'
                                    }`}
                                title="Gestionar Inventario"
                            >
                                <Settings className="w-5 h-5" />
                            </button>
                        )}
                        {isManaging && (
                            <button
                                onClick={() => handleOpenModal()}
                                className="p-3 rounded-xl bg-amber-500 text-white shadow-lg shadow-amber-500/20 hover:bg-amber-600 transition-all font-bold flex items-center gap-2"
                            >
                                <Plus className="w-5 h-5" />
                                <span className="hidden md:inline">Nuevo</span>
                            </button>
                        )}
                    </div>

                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        {categories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setActiveFilter(cat)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeFilter === cat
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                                    : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent hover:border-white/5'
                                    }`}
                            >
                                {cat === 'All' ? 'Todos' : cat}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Products Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 overflow-y-auto pr-2 pb-20">
                    {filteredProducts.map(product => (
                        <div
                            key={product.id}
                            className={`group relative bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-2xl overflow-hidden transition-all duration-200 hover:border-white/10 hover:shadow-xl hover:shadow-blue-500/5 ${product.stock === 0 ? 'opacity-50 grayscale' : ''
                                } ${isManaging ? 'border-amber-500/20' : ''}`}
                        >
                            <div className="aspect-square relative overflow-hidden bg-slate-800">
                                {product.imagen ? (
                                    <img
                                        src={product.imagen}
                                        alt={product.name}
                                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-600">
                                        <ImageIcon className="w-12 h-12" />
                                    </div>
                                )}
                                <div className="absolute top-3 right-3 flex flex-col gap-2">
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold border self-end ${product.stock === 0
                                        ? 'bg-slate-800/90 text-slate-400 border-slate-700'
                                        : (product.min_stock && product.stock < product.min_stock)
                                            ? 'bg-orange-500/90 text-white border-orange-400/50 animate-pulse'
                                            : 'bg-green-500/90 text-white border-green-400/50'
                                        }`}>
                                        {product.stock === 0 ? 'Sin Stock' : `${product.stock} un.`}
                                    </span>
                                </div>

                                {/* Admin Overlay */}
                                {isManaging && (
                                    <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px] flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => handleOpenModal(product)}
                                            className="p-2 bg-blue-600 rounded-full text-white hover:bg-blue-500 transition-colors shadow-lg"
                                        >
                                            <Edit className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteProduct(product.id)}
                                            className="p-2 bg-red-600 rounded-full text-white hover:bg-red-500 transition-colors shadow-lg"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="p-4">
                                <h3 className="font-semibold text-slate-200 truncate">{product.name}</h3>
                                <p className="text-blue-400 font-bold mt-1">{formatCurrency(product.price)}</p>

                                <button
                                    onClick={() => addToCart(product)}
                                    disabled={product.stock === 0 || isManaging}
                                    className="mt-3 w-full py-2 bg-white/5 hover:bg-blue-600/20 hover:text-blue-400 border border-white/5 rounded-lg flex items-center justify-center gap-2 transition-all disabled:cursor-not-allowed disabled:hover:bg-white/5 disabled:hover:text-slate-500"
                                >
                                    <Plus className="w-4 h-4" />
                                    <span>Añadir</span>
                                </button>
                            </div>
                        </div>
                    ))}
                    {filteredProducts.length === 0 && (
                        <div className="col-span-full flex flex-col items-center justify-center py-12 text-slate-500">
                            <Package className="w-12 h-12 mb-3 opacity-20" />
                            <p>No se encontraron productos</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Right Column: Cart Sidebar (30%) */}
            <div className="w-[30%] min-w-[320px] bg-slate-900/60 backdrop-blur-xl border-l border-white/5 flex flex-col h-full rounded-l-3xl shadow-2xl shadow-black/50">
                <div className="p-6 border-b border-white/5">
                    <div className="flex items-center gap-3 text-slate-200">
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                            <ShoppingCart className="w-5 h-5 text-blue-400" />
                        </div>
                        <h2 className="text-lg font-bold">Carrito Actual</h2>
                        <span className="ml-auto bg-slate-800 text-xs px-2 py-1 rounded-full text-slate-400">
                            {cart.reduce((acc, item) => acc + item.quantity, 0)} items
                        </span>
                    </div>
                </div>

                {/* Cart Items List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {cart.map(item => (
                        <div key={item.product.id} className="flex gap-3 p-3 bg-slate-800/30 rounded-xl border border-white/5 group hover:border-white/10 transition-colors">
                            <img
                                src={item.product.imagen || undefined}
                                alt={item.product.name}
                                className="w-16 h-16 rounded-lg object-cover bg-slate-800"
                            />
                            <div className="flex-1 flex flex-col justify-between">
                                <div className="flex justify-between items-start">
                                    <h4 className="font-medium text-sm text-slate-300 line-clamp-1">{item.product.name}</h4>
                                    <button
                                        onClick={() => removeFromCart(item.product.id)}
                                        className="text-slate-500 hover:text-red-400 transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4 ml-2" />
                                    </button>
                                </div>

                                <div className="flex items-center justify-between mt-2">
                                    <span className="text-blue-400 font-semibold text-sm">
                                        {formatCurrency(item.product.price * item.quantity)}
                                    </span>

                                    <div className="flex items-center gap-3 bg-slate-950/50 rounded-lg p-1 border border-white/5">
                                        <button
                                            onClick={() => item.quantity > 1 ? updateQuantity(item.product.id, -1) : removeFromCart(item.product.id)}
                                            className="p-1 hover:bg-slate-700 rounded transition-colors text-slate-400 hover:text-white"
                                        >
                                            <Minus className="w-3 h-3" />
                                        </button>
                                        <span className="text-xs font-bold w-4 text-center">{item.quantity}</span>
                                        <button
                                            onClick={() => updateQuantity(item.product.id, 1)}
                                            disabled={item.quantity >= item.product.stock}
                                            className="p-1 hover:bg-slate-700 rounded transition-colors text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                                        >
                                            <Plus className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                    {cart.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-slate-600 space-y-4">
                            <ShoppingCart className="w-12 h-12 opacity-20" />
                            <p className="text-sm">El carrito está vacío</p>
                        </div>
                    )}
                </div>

                {/* Footer Section */}
                <div className="p-6 bg-slate-900/80 border-t border-white/5 backdrop-blur-md space-y-4">
                    {/* Summary */}
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between text-slate-400">
                            <span>Subtotal</span>
                            <span>{formatCurrency(subtotal)}</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                            <span>Impuestos (16%)</span>
                            <span>{formatCurrency(tax)}</span>
                        </div>
                        <div className="flex justify-between text-slate-200 text-lg font-bold pt-2 border-t border-white/10 mt-2">
                            <span>Total</span>
                            <span className="text-blue-400">{formatCurrency(total)}</span>
                        </div>
                    </div>

                    {/* Payment Method */}
                    <div className="grid grid-cols-2 gap-2 bg-slate-950/50 p-1 rounded-xl border border-white/5">
                        <button
                            onClick={() => setPaymentMethod('cash')}
                            className={`flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${paymentMethod === 'cash'
                                ? 'bg-slate-800 text-white shadow-sm ring-1 ring-white/10'
                                : 'text-slate-500 hover:text-slate-300'
                                }`}
                        >
                            <Banknote className="w-4 h-4" />
                            Efectivo
                        </button>
                        <button
                            onClick={() => setPaymentMethod('card')}
                            className={`flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${paymentMethod === 'card'
                                ? 'bg-slate-800 text-white shadow-sm ring-1 ring-white/10'
                                : 'text-slate-500 hover:text-slate-300'
                                }`}
                        >
                            <CreditCard className="w-4 h-4" />
                            Tarjeta
                        </button>
                    </div>

                    {/* Action Button */}
                    <Button
                        variant="primary"
                        isLoading={isProcessing}
                        disabled={cart.length === 0}
                        onClick={handleCheckout}
                        className="w-full py-4 text-base shadow-xl shadow-blue-500/20"
                    >
                        Finalizar Venta
                    </Button>
                </div>
            </div>

            {/* Product Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xl p-4">
                    <div className="bg-slate-900/90 backdrop-blur-xl border border-white/10 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 ring-1 ring-white/10">
                        <div className="p-5 border-b border-white/5 flex justify-between items-center bg-slate-900/50">
                            <div className="flex items-center gap-2">
                                <span className="p-2 bg-blue-500/10 rounded-lg text-blue-500 border border-blue-500/20">
                                    <Settings className="w-5 h-5" />
                                </span>
                                <h3 className="text-lg font-bold text-slate-100">
                                    {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
                                </h3>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6">
                            {/* Error Alert */}
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
                                        />
                                        <Input
                                            label="Costo Adquisición ($)"
                                            type="number"
                                            value={cost}
                                            onChange={e => setCost(e.target.value)}
                                            placeholder="Opcional"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <Input
                                            label="Stock Actual"
                                            type="number"
                                            value={stock}
                                            onChange={e => setStock(e.target.value)}
                                            placeholder="0"
                                        />
                                        <Input
                                            label="Stock Mínimo (Alerta)"
                                            type="number"
                                            value={minStock}
                                            onChange={e => setMinStock(e.target.value)}
                                            placeholder="5"
                                            className="border-orange-500/30 focus-visible:ring-orange-500/20 text-orange-200"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-slate-400 mb-1">Categoría</label>
                                        <select
                                            value={category}
                                            onChange={e => setCategory(e.target.value)}
                                            className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                        >
                                            {categories.filter(c => c !== 'All').map(c => (
                                                <option key={c} value={c}>{c}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Right Column: Image */}
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-2">Imagen del Producto</label>
                                    <div className="h-full flex flex-col gap-4">
                                        <div className="flex-1 bg-slate-950/50 rounded-xl border-2 border-dashed border-slate-800 flex flex-col items-center justify-center relative overflow-hidden group hover:border-blue-500/20 transition-colors">
                                            {previewUrl ? (
                                                <>
                                                    <img src={previewUrl} alt="Preview" className="w-full h-full object-contain p-4" />
                                                    <button
                                                        onClick={() => {
                                                            setPreviewUrl('');
                                                            setImageFile(null);
                                                        }}
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
                                        <p className="text-xs text-center text-slate-500">
                                            Recomendado: 500x500px, PNG o JPG
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer Section - Specific Design */}
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
                                <Button
                                    variant="ghost"
                                    onClick={() => setIsModalOpen(false)}
                                    className="border border-white/5 hover:bg-white/5 text-slate-400 hover:text-white"
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    variant="primary"
                                    isLoading={isLoadingSave}
                                    onClick={handleSaveProduct}
                                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 border-none shadow-lg shadow-blue-500/20 text-white"
                                    icon={!isLoadingSave && <Save className="w-4 h-4" />}
                                >
                                    Guardar Producto
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InventoryPOS;
