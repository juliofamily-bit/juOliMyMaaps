import React, { useState, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Product, Ingredient, Order, Expense, OrderStatus, Category, ProductIngredient } from '@/types/database';
import { PRESET_IMAGES, NEON_ICONS } from '@/lib/constants';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';
import { Plus, Trash2, Edit, TrendingUp, DollarSign, Package, Layers, History, ChevronRight, X, Save, Check, Upload, Image as ImageIcon, Wallet, Receipt, ArrowUpCircle, ArrowDownCircle, Calendar, FilterX, Star, PieChart } from 'lucide-react';

interface AdminTabProps {
    products: Product[];
    categories: Category[];
    ingredients: Ingredient[];
    orders: Order[];
    expenses: Expense[];
    productIngredients: ProductIngredient[];
}

const formatARS = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        maximumFractionDigits: 0
    }).format(amount);
};

const AdminTab: React.FC<AdminTabProps> = ({
    products, categories, ingredients, orders, expenses, productIngredients
}) => {
    const [view, setView] = useState<'dashboard' | 'stock' | 'products' | 'sales' | 'balance'>('dashboard');
    const [salesPeriod, setSalesPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');

    // Modal & Filter States
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [isStockModalOpen, setIsStockModalOpen] = useState(false);
    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
    const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
    const [editingStockId, setEditingStockId] = useState<string | null>(null);
    const [selectedMonthFilter, setSelectedMonthFilter] = useState<string | null>(null);

    // New Category Form State
    const [catName, setCatName] = useState('');
    const [catIcon, setCatIcon] = useState('🍔');

    // New Product Form State
    const [prodName, setProdName] = useState('');
    const [prodPrice, setProdPrice] = useState('');
    const [prodImage, setProdImage] = useState(PRESET_IMAGES[0].url);
    const [prodIngredients, setProdIngredients] = useState<ProductIngredient[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Stock Form State
    const [stkName, setStkName] = useState('');
    const [stkPrice, setStkPrice] = useState('');
    const [stkLevel, setStkLevel] = useState('');
    const [stkUnit, setStkUnit] = useState('uds');
    const [stkMinAlert, setStkMinAlert] = useState('10');

    // Expense Form State
    const [expDesc, setExpDesc] = useState('');
    const [expAmount, setExpAmount] = useState('');
    const [expType, setExpType] = useState<Expense['type']>('purchase');

    // Sales Stats Logic
    const filteredOrders = useMemo(() => {
        const now = Date.now();
        const day = 24 * 60 * 60 * 1000;
        return orders.filter(o => {
            const oDate = new Date(o.created_at).getTime();
            if (salesPeriod === 'daily') return now - oDate < day;
            if (salesPeriod === 'weekly') return now - oDate < day * 7;
            if (salesPeriod === 'monthly') return now - oDate < day * 30;
            return true;
        });
    }, [orders, salesPeriod]);

    const bestSellers = useMemo(() => {
        const counts: Record<string, number> = {};
        filteredOrders.forEach(o => {
            o.items?.forEach(item => {
                if (item.product_id) counts[item.product_id] = (counts[item.product_id] || 0) + item.quantity;
            });
        });
        return Object.entries(counts)
            .map(([id, qty]) => ({ id, qty, name: products.find(p => p.id === id)?.name || 'Desconocido' }))
            .sort((a, b) => b.qty - a.qty);
    }, [filteredOrders, products]);

    const totalRevenue = filteredOrders.reduce((sum, o) => sum + o.total_price, 0);

    // Balance Logic
    const monthlyBalance = useMemo(() => {
        const months: Record<string, {
            income: number,
            expense: number,
            transactions: any[],
            productStats: Record<string, number>,
            ingredientStats: Record<string, number>
        }> = {};

        orders.forEach(o => {
            const date = new Date(o.created_at);
            const key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
            if (!months[key]) months[key] = { income: 0, expense: 0, transactions: [], productStats: {}, ingredientStats: {} };

            months[key].income += o.total_price;
            months[key].transactions.push({ ...o, type: 'income' });

            // Calculate product and ingredient stats for this month
            o.items?.forEach(item => {
                const prod = products.find(p => p.id === item.product_id);
                // Products
                if (item.product_id) months[key].productStats[item.product_id] = (months[key].productStats[item.product_id] || 0) + item.quantity;
                // Ingredients
                if (prod) {
                    const pIngs = productIngredients.filter(pi => pi.product_id === prod.id);
                    pIngs.forEach(ing => {
                        months[key].ingredientStats[ing.ingredient_id] = (months[key].ingredientStats[ing.ingredient_id] || 0) + (ing.quantity_used * item.quantity);
                    });
                }
            });
        });

        expenses.forEach(e => {
            const date = new Date(e.date);
            const key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
            if (!months[key]) months[key] = { income: 0, expense: 0, transactions: [], productStats: {}, ingredientStats: {} };
            months[key].expense += e.amount;
            months[key].transactions.push({ ...e, type: 'expense' });
        });

        return Object.entries(months).sort((a, b) => b[0].localeCompare(a[0]));
    }, [orders, expenses, products]);

    const chartData = useMemo(() => {
        return monthlyBalance.map(([month, data]) => ({
            monthKey: month,
            name: new Date(month + '-01').toLocaleDateString('es-AR', { month: 'short' }),
            profit: data.income - data.expense,
            income: data.income,
            expense: data.expense
        })).reverse();
    }, [monthlyBalance]);

    // Handlers
    const handleAddCategory = async () => {
        if (!catName.trim()) return;
        const { error } = await supabase.from('categories').insert([{ name: catName, icon: catIcon }]);
        if (error) {
            console.error('Error creating category:', error);
            alert('Error creating category');
        }
        setCatName('');
        setIsCategoryModalOpen(false);
    };

    const handleAddProduct = async () => {
        if (!prodName.trim() || !prodPrice || !activeCategoryId) return;

        const { data: prodData, error: prodError } = await supabase.from('products').insert([{
            name: prodName,
            price: parseFloat(prodPrice),
            category_id: activeCategoryId,
            description: '',
            image_url: prodImage
        }]).select().single();

        if (prodError || !prodData) {
            console.error('Error creating product:', prodError);
            alert('Error creating product');
            return;
        }

        if (prodIngredients.length > 0) {
            const piInserts = prodIngredients.map(pi => ({
                product_id: prodData.id,
                ingredient_id: pi.ingredient_id,
                quantity_used: pi.quantity_used
            }));
            const { error: piError } = await supabase.from('product_ingredients').insert(piInserts);
            if (piError) {
                console.error('Error adding ingredients:', piError);
                alert('Error adding ingredients to product');
            }
        }

        setProdName(''); setProdPrice(''); setProdImage(PRESET_IMAGES[0].url); setProdIngredients([]);
        setIsProductModalOpen(false);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage.from('products').upload(filePath, file);

        if (uploadError) {
            console.error('Error uploading image:', uploadError);
            alert('Error uploading image');
            return;
        }

        const { data } = supabase.storage.from('products').getPublicUrl(filePath);
        setProdImage(data.publicUrl);
    };

    const handleSaveStock = async () => {
        if (!stkName.trim() || !stkPrice || !stkLevel) return;

        const stockData = {
            name: stkName,
            unit_price: parseFloat(stkPrice),
            stock_level: parseFloat(stkLevel),
            unit: stkUnit,
            min_stock_alert: parseFloat(stkMinAlert) || 10
        };

        if (editingStockId) {
            const { error } = await supabase.from('ingredients').update(stockData).eq('id', editingStockId);
            if (error) alert('Error updating stock');
        } else {
            const { error } = await supabase.from('ingredients').insert([stockData]);
            if (error) alert('Error creating stock');
        }

        setStkName(''); setStkPrice(''); setStkLevel(''); setStkUnit('uds'); setStkMinAlert('10');
        setEditingStockId(null);
        setIsStockModalOpen(false);
    };

    const handleAddExpense = async () => {
        if (!expDesc.trim() || !expAmount) return;
        const { error } = await supabase.from('expenses').insert([{
            description: expDesc,
            amount: parseFloat(expAmount),
            date: new Date().toISOString(),
            type: expType
        }]);
        if (error) alert('Error creating expense');

        setExpDesc(''); setExpAmount(''); setExpType('purchase');
        setIsExpenseModalOpen(false);
    };

    const openEditStock = (item: Ingredient) => {
        setEditingStockId(item.id);
        setStkName(item.name);
        setStkPrice(item.unit_price.toString());
        setStkLevel(item.stock_level.toString());
        setStkUnit(item.unit);
        setStkMinAlert(item.min_stock_alert.toString());
        setIsStockModalOpen(true);
    };

    const toggleIngredient = (id: string) => {
        setProdIngredients(prev => {
            const exists = prev.find(i => i.ingredient_id === id);
            if (exists) return prev.filter(i => i.ingredient_id !== id);
            // Construct a valid ProductIngredient structure for local state (missing some required fields like id, product_id, but they are not needed for display)
            return [...prev, { ingredient_id: id, quantity_used: 1 } as any];
        });
    };

    const updateIngredientQty = (id: string, qty: number) => {
        setProdIngredients(prev => prev.map(i => i.ingredient_id === id ? { ...i, quantity_used: qty } : i));
    };

    const handleBarClick = (data: any) => {
        if (data && data.monthKey) {
            setSelectedMonthFilter(data.monthKey === selectedMonthFilter ? null : data.monthKey);
        }
    };

    const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
        const { error } = await supabase.from('orders').update({ status }).eq('id', orderId);
        if (error) {
            console.error('Error updating order status:', error);
            alert('Error updating order status');
        }
    };

    return (
        <div className="space-y-6 pb-4">
            <div className="flex gap-2 bg-slate-900/50 p-1 rounded-2xl border border-slate-800 overflow-x-auto scrollbar-hide">
                {(['dashboard', 'stock', 'products', 'balance', 'sales'] as const).map(v => (
                    <button
                        key={v} onClick={() => setView(v)}
                        className={`flex-1 py-3 px-4 rounded-xl text-[9px] font-black uppercase transition-all whitespace-nowrap ${view === v ? 'bg-orange-500 text-white shadow-lg' : 'text-slate-500'}`}
                    >
                        {v === 'dashboard' ? <TrendingUp size={14} className="mx-auto" /> :
                            v === 'stock' ? 'Stock' :
                                v === 'products' ? 'Menú' :
                                    v === 'balance' ? 'Balance' : 'Ventas'}
                    </button>
                ))}
            </div>

            {view === 'dashboard' && (
                <div className="space-y-6 animate-in fade-in">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="glass p-5 rounded-[2rem] border border-white/5">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Ingresos {salesPeriod}</p>
                            <h3 className="text-xl font-black text-white font-mono">{formatARS(totalRevenue)}</h3>
                        </div>
                        <div className="glass p-5 rounded-[2rem] border border-white/5">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Pedidos</p>
                            <h3 className="text-2xl font-black text-white font-mono">{filteredOrders.length}</h3>
                        </div>
                    </div>

                    <div className="glass p-6 rounded-[2.5rem] border border-white/5">
                        <h4 className="text-[10px] font-black uppercase text-orange-500 mb-4">Lo más vendido</h4>
                        <div className="space-y-3">
                            {bestSellers.slice(0, 5).map((item, i) => (
                                <div key={item.id} className="flex justify-between items-center bg-slate-950/30 p-3 rounded-2xl">
                                    <div className="flex items-center gap-3">
                                        <span className="text-slate-600 font-black text-xs">#0{i + 1}</span>
                                        <span className="font-bold text-sm text-white">{item.name}</span>
                                    </div>
                                    <span className="bg-orange-500/10 text-orange-500 px-3 py-1 rounded-lg text-xs font-black">{item.qty} uds</span>
                                </div>
                            ))}
                            {bestSellers.length === 0 && <p className="text-center text-slate-600 text-xs py-4">Sin datos de ventas en este periodo.</p>}
                        </div>
                    </div>
                </div>
            )}

            {view === 'stock' && (
                <div className="space-y-4 animate-in slide-in-from-bottom-4">
                    <div className="flex justify-between items-center px-2">
                        <h3 className="font-black uppercase italic text-sm">Insumos y Almacén</h3>
                        <button
                            onClick={() => { setEditingStockId(null); setStkName(''); setStkPrice(''); setStkLevel(''); setIsStockModalOpen(true); }}
                            className="bg-orange-500 p-2 rounded-xl text-white shadow-lg"><Plus size={18} /></button>
                    </div>
                    <div className="space-y-2">
                        {ingredients.map(item => (
                            <div key={item.id}
                                onClick={() => openEditStock(item)}
                                className="glass p-4 rounded-3xl flex justify-between items-center border border-white/5 active:scale-95 transition-all cursor-pointer"
                            >
                                <div>
                                    <span className="font-black text-white block">{item.name}</span>
                                    <span className="text-[10px] font-bold text-slate-500 uppercase">Costo: {formatARS(item.unit_price)} / {item.unit}</span>
                                </div>
                                <div className="text-right">
                                    <p className={`font-black text-lg ${item.stock_level <= item.min_stock_alert ? 'text-red-500' : 'text-green-500'}`}>
                                        {item.stock_level.toFixed(1)} <span className="text-[10px] text-slate-500">{item.unit}</span>
                                    </p>
                                    <button onClick={async (e) => {
                                        e.stopPropagation();
                                        if (window.confirm('¿Borrar insumo?')) await supabase.from('ingredients').delete().eq('id', item.id);
                                    }} className="text-red-500/30 hover:text-red-500">
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {view === 'products' && (
                <div className="space-y-6 animate-in slide-in-from-right-4">
                    <div className="flex justify-between items-center px-2">
                        <h3 className="font-black uppercase italic text-sm">Categorías y Menú</h3>
                        <button
                            onClick={() => setIsCategoryModalOpen(true)}
                            className="bg-orange-500 px-4 py-2 rounded-xl text-white text-[10px] font-black uppercase">Nueva Categoría</button>
                    </div>

                    {categories.map(cat => (
                        <div key={cat.id} className="space-y-3 bg-slate-900/30 p-4 rounded-[2rem] border border-white/5">
                            <div className="flex justify-between items-center border-b border-white/5 pb-2 mb-2">
                                <h4 className="font-black text-orange-500 flex items-center gap-2 text-sm"><span className="neon-icon">{cat.icon}</span> {cat.name}</h4>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => { setActiveCategoryId(cat.id); setIsProductModalOpen(true); }}
                                        className="text-green-500 bg-green-500/10 p-2 rounded-lg"><Plus size={14} /></button>
                                    <button onClick={async () => {
                                        if (window.confirm('¿Borrar categoría?')) await supabase.from('categories').delete().eq('id', cat.id);
                                    }} className="text-red-500/40"><Trash2 size={14} /></button>
                                </div>
                            </div>
                            {products.filter(p => p.category_id === cat.id).map(prod => (
                                <div key={prod.id} className="flex justify-between items-center text-xs p-2 hover:bg-white/5 rounded-xl transition-all">
                                    <div className="flex items-center gap-3">
                                        <img src={prod.image_url || ''} className="w-8 h-8 rounded-lg object-cover border border-white/10" />
                                        <span className="font-bold">{prod.name}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-slate-500 font-mono">{formatARS(prod.price)}</span>
                                        <button onClick={async () => {
                                            if (window.confirm('¿Borrar producto?')) await supabase.from('products').delete().eq('id', prod.id);
                                        }} className="text-red-500/20"><Trash2 size={12} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            )}

            {view === 'balance' && (
                <div className="space-y-6 animate-in fade-in">
                    <div className="flex justify-between items-center px-2">
                        <h3 className="font-black uppercase italic text-sm">Rentabilidad Mensual</h3>
                        <button
                            onClick={() => setIsExpenseModalOpen(true)}
                            className="bg-red-500 p-2 rounded-xl text-white shadow-lg flex items-center gap-2 px-4">
                            <Plus size={18} /> <span className="text-[10px] font-black uppercase">Cargar Gasto</span>
                        </button>
                    </div>

                    {/* Rentabilidad Chart */}
                    <div className="glass p-4 rounded-[2.5rem] h-64 border border-white/5 relative group">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} onClick={(e: any) => handleBarClick(e?.activePayload?.[0]?.payload)}>
                                <defs>
                                    <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#ea580c" stopOpacity={0.2} />
                                    </linearGradient>
                                </defs>
                                <Tooltip
                                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '16px' }}
                                    itemStyle={{ color: '#f97316', fontSize: '12px', fontWeight: 'bold' }}
                                    formatter={(val: number | any) => formatARS(Number(val) || 0)}
                                />
                                <XAxis dataKey="name" stroke="#64748b" fontSize={10} axisLine={false} tickLine={false} />
                                <Bar dataKey="profit" radius={[8, 8, 0, 0]}>
                                    {chartData.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={entry.monthKey === selectedMonthFilter ? '#f97316' : (entry.profit >= 0 ? '#10b981' : '#ef4444')}
                                            opacity={selectedMonthFilter && entry.monthKey !== selectedMonthFilter ? 0.3 : 0.8}
                                            className="transition-all duration-300"
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                        <div className="absolute top-4 right-4 flex items-center gap-2 pointer-events-none">
                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Haz clic en un mes para ver detalle</span>
                        </div>
                    </div>

                    <div className="flex items-center justify-between px-2">
                        <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-widest">
                            {selectedMonthFilter ? `Desglose: ${new Date(selectedMonthFilter + '-01').toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}` : 'Todos los Periodos'}
                        </h4>
                        {selectedMonthFilter && (
                            <button
                                onClick={() => setSelectedMonthFilter(null)}
                                className="flex items-center gap-1 text-[10px] font-black uppercase text-orange-500"
                            >
                                <FilterX size={14} /> Ver Todo
                            </button>
                        )}
                    </div>

                    {monthlyBalance
                        .filter(([month]) => !selectedMonthFilter || month === selectedMonthFilter)
                        .map(([month, data]) => (
                            <div key={month} className="space-y-4 animate-in slide-in-from-bottom-4">
                                {/* Financial Summary Card */}
                                <div className="glass rounded-[2rem] overflow-hidden border border-white/5">
                                    <div className="bg-slate-900/80 p-5 flex justify-between items-center border-b border-white/5">
                                        <div className="flex items-center gap-3">
                                            <Calendar size={18} className="text-orange-500" />
                                            <h4 className="font-black text-white uppercase text-sm">{new Date(month + '-01').toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}</h4>
                                        </div>
                                        <div className="text-right">
                                            <p className={`font-black text-lg ${data.income - data.expense >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                {formatARS(data.income - data.expense)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="p-5 space-y-4">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-slate-950/40 p-3 rounded-2xl border border-green-500/10">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <ArrowUpCircle size={14} className="text-green-500" />
                                                    <span className="text-[8px] font-black uppercase text-slate-500">Ingresos</span>
                                                </div>
                                                <p className="font-black text-white text-sm">{formatARS(data.income)}</p>
                                            </div>
                                            <div className="bg-slate-950/40 p-3 rounded-2xl border border-red-500/10">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <ArrowDownCircle size={14} className="text-red-500" />
                                                    <span className="text-[8px] font-black uppercase text-slate-500">Gastos</span>
                                                </div>
                                                <p className="font-black text-white text-sm">{formatARS(data.expense)}</p>
                                            </div>
                                        </div>

                                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                                            {data.transactions.sort((a, b) => (b.createdAt || b.date) - (a.createdAt || a.date)).map((t: any) => (
                                                <div key={t.id} className="flex justify-between items-center text-[10px] p-2 hover:bg-white/5 rounded-xl border-b border-white/5 last:border-0">
                                                    <div className="flex items-center gap-3">
                                                        <span className={t.type === 'income' ? 'text-green-500' : 'text-red-500'}>
                                                            {t.type === 'income' ? '●' : '●'}
                                                        </span>
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-white">{t.clientName || t.description}</span>
                                                            <span className="text-slate-600 uppercase text-[7px] font-black">
                                                                {t.type === 'income' ? 'Venta' : (t.type === 'purchase' ? 'Insumos' : t.type === 'salary' ? 'Nómina' : t.type)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <span className={`font-black ${t.type === 'income' ? 'text-green-500' : 'text-white'}`}>
                                                        {t.type === 'income' ? '+' : '-'}{formatARS(t.totalPrice || t.amount)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Performance Details: Only visible when a specific month is selected */}
                                {selectedMonthFilter === month && (
                                    <div className="grid grid-cols-1 gap-4 animate-in slide-in-from-right-4">
                                        {/* Top Products Report */}
                                        <div className="glass rounded-[2rem] p-5 border border-white/5 space-y-4">
                                            <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                                                <Star className="text-yellow-500" size={18} />
                                                <h5 className="font-black text-white uppercase text-[10px] tracking-widest">Productos más vendidos</h5>
                                            </div>
                                            <div className="space-y-3">
                                                {Object.entries(data.productStats)
                                                    .sort((a, b) => b[1] - a[1])
                                                    .slice(0, 5)
                                                    .map(([pid, qty]) => {
                                                        const p = products.find(prod => prod.id === pid);
                                                        const maxQty = Math.max(...Object.values(data.productStats));
                                                        return (
                                                            <div key={pid} className="space-y-1">
                                                                <div className="flex justify-between items-center text-xs">
                                                                    <span className="font-bold text-slate-300">{p?.name || 'Producto'}</span>
                                                                    <span className="font-black text-orange-500">{qty} uds</span>
                                                                </div>
                                                                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                                                    <div className="h-full bg-orange-500 rounded-full transition-all duration-500" style={{ width: `${(qty / maxQty) * 100}%` }}></div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                {Object.keys(data.productStats).length === 0 && (
                                                    <p className="text-center text-slate-600 text-[10px] font-bold py-4">Sin datos de productos este mes</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Most Consumed Ingredients Report */}
                                        <div className="glass rounded-[2rem] p-5 border border-white/5 space-y-4">
                                            <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                                                <PieChart className="text-cyan-500" size={18} />
                                                <h5 className="font-black text-white uppercase text-[10px] tracking-widest">Insumos más consumidos</h5>
                                            </div>
                                            <div className="space-y-3">
                                                {Object.entries(data.ingredientStats)
                                                    .sort((a, b) => b[1] - a[1])
                                                    .slice(0, 5)
                                                    .map(([iid, qty]) => {
                                                        const ing = ingredients.find(inv => inv.id === iid);
                                                        const maxQty = Math.max(...Object.values(data.ingredientStats));
                                                        return (
                                                            <div key={iid} className="space-y-1">
                                                                <div className="flex justify-between items-center text-xs">
                                                                    <span className="font-bold text-slate-300">{ing?.name || 'Insumo'}</span>
                                                                    <span className="font-black text-cyan-500">{qty.toFixed(1)} {ing?.unit}</span>
                                                                </div>
                                                                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                                                    <div className="h-full bg-cyan-500 rounded-full transition-all duration-500" style={{ width: `${(qty / maxQty) * 100}%` }}></div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                {Object.keys(data.ingredientStats).length === 0 && (
                                                    <p className="text-center text-slate-600 text-[10px] font-bold py-4">Sin datos de insumos este mes</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                </div>
            )}

            {view === 'sales' && (
                <div className="space-y-6 animate-in fade-in">
                    <div className="flex gap-2 p-1 bg-slate-900 rounded-xl overflow-x-auto scrollbar-hide">
                        {(['daily', 'weekly', 'monthly', 'yearly'] as const).map(p => (
                            <button
                                key={p} onClick={() => setSalesPeriod(p)}
                                className={`flex-1 py-2 px-3 rounded-lg text-[9px] font-black uppercase transition-all ${salesPeriod === p ? 'bg-slate-800 text-orange-500' : 'text-slate-600'}`}
                            >
                                {p === 'daily' ? 'Hoy' : p === 'weekly' ? 'Semana' : p === 'monthly' ? 'Mes' : 'Año'}
                            </button>
                        ))}
                    </div>

                    <div className="space-y-3">
                        {filteredOrders.map(order => (
                            <div key={order.id} className="glass p-4 rounded-3xl border border-white/5 flex justify-between items-center">
                                <div>
                                    <p className="font-black text-sm">{order.client_name}</p>
                                    <p className="text-[9px] font-bold text-slate-500 uppercase">{new Date(order.created_at).toLocaleDateString()} • {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-black text-orange-500 font-mono">{formatARS(order.total_price)}</p>
                                    <button onClick={() => updateOrderStatus(order.id, 'pending')} className="text-[9px] font-black uppercase text-slate-600 hover:text-orange-400">Reabrir</button>
                                </div>
                            </div>
                        ))}
                        {filteredOrders.length === 0 && <p className="text-center text-slate-600 py-20 font-bold uppercase tracking-widest">Sin Ventas</p>}
                    </div>
                </div>
            )}

            {/* Expense Modal */}
            {isExpenseModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="glass w-full max-w-sm rounded-[2.5rem] p-8 space-y-6 shadow-2xl border border-white/10">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xl font-black uppercase italic text-red-500">Nuevo Gasto</h3>
                            <button onClick={() => setIsExpenseModalOpen(false)} className="text-slate-500"><X /></button>
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Descripción</label>
                                <input type="text" value={expDesc} onChange={e => setExpDesc(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white font-bold outline-none" placeholder="Ej: Pago de Luz" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Monto (ARS $)</label>
                                <input type="number" value={expAmount} onChange={e => setExpAmount(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white font-bold outline-none" placeholder="0" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Categoría</label>
                                <select
                                    value={expType}
                                    onChange={e => setExpType(e.target.value as Expense['type'])}
                                    className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white font-bold outline-none appearance-none"
                                >
                                    <option value="purchase">Insumos / Compra</option>
                                    <option value="salary">Nómina / Sueldos</option>
                                    <option value="service">Servicios (Luz, Agua, etc)</option>
                                    <option value="tax">Impuestos</option>
                                    <option value="other">Otros Gastos</option>
                                </select>
                            </div>
                            <button onClick={handleAddExpense} className="w-full py-5 bg-red-600 text-white font-black rounded-2xl shadow-xl uppercase tracking-widest">Registrar Gasto</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Category Modal */}
            {isCategoryModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="glass w-full max-w-sm rounded-[2.5rem] p-8 space-y-6 shadow-2xl border border-white/10">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xl font-black uppercase italic text-orange-500">Categoría</h3>
                            <button onClick={() => setIsCategoryModalOpen(false)} className="text-slate-500"><X /></button>
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Nombre</label>
                                <input type="text" value={catName} onChange={e => setCatName(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white font-bold outline-none" placeholder="Ej: Hamburguesas" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Selecciona un Icono</label>
                                <div className="grid grid-cols-5 gap-2">
                                    {NEON_ICONS.map((item, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => setCatIcon(item.icon)}
                                            className={`aspect-square flex items-center justify-center text-2xl rounded-xl transition-all border ${catIcon === item.icon ? 'bg-orange-500/20 border-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]' : 'bg-slate-900 border-slate-800'}`}
                                        >
                                            <span className="neon-icon">{item.icon}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <button onClick={handleAddCategory} className="w-full py-5 bg-orange-600 text-white font-black rounded-2xl shadow-xl uppercase tracking-widest">Guardar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Stock Modal (Insumos) */}
            {isStockModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="glass w-full max-w-sm rounded-[2.5rem] p-8 space-y-6 shadow-2xl border border-white/10">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xl font-black uppercase italic text-orange-500">
                                {editingStockId ? 'Editar Insumo' : 'Nuevo Insumo'}
                            </h3>
                            <button onClick={() => setIsStockModalOpen(false)} className="text-slate-500"><X /></button>
                        </div>
                        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Nombre del Insumo</label>
                                <input type="text" value={stkName} onChange={e => setStkName(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white font-bold outline-none" placeholder="Ej: Pan Focaccia" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Precio Costo ($)</label>
                                    <input type="number" value={stkPrice} onChange={e => setStkPrice(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white font-bold outline-none" placeholder="0.00" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Stock Inicial</label>
                                    <input type="number" value={stkLevel} onChange={e => setStkLevel(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white font-bold outline-none" placeholder="0" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Unidad (uds, kg, l)</label>
                                    <input type="text" value={stkUnit} onChange={e => setStkUnit(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white font-bold outline-none" placeholder="uds" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Alerta en (nivel)</label>
                                    <input type="number" value={stkMinAlert} onChange={e => setStkMinAlert(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white font-bold outline-none" placeholder="10" />
                                </div>
                            </div>
                            <button onClick={handleSaveStock} className="w-full py-5 bg-orange-600 text-white font-black rounded-2xl shadow-xl uppercase tracking-widest mt-2">
                                {editingStockId ? 'Actualizar Insumo' : 'Crear Insumo'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Product Modal */}
            {isProductModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm animate-in fade-in overflow-y-auto pt-10 pb-10">
                    <div className="glass w-full max-w-sm rounded-[3rem] p-8 space-y-6 shadow-2xl border border-white/10 my-auto">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xl font-black uppercase italic text-orange-500">Nuevo Producto</h3>
                            <button onClick={() => setIsProductModalOpen(false)} className="text-slate-500"><X /></button>
                        </div>

                        <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-2 custom-scrollbar">
                            {/* Image Picker Section */}
                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Imagen del Producto</label>
                                <div className="flex items-center gap-4">
                                    <div className="w-24 h-24 rounded-3xl overflow-hidden border-2 border-orange-500/50 flex-shrink-0">
                                        <img src={prodImage} className="w-full h-full object-cover" />
                                    </div>
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="flex-1 h-24 border-2 border-dashed border-slate-700 rounded-3xl flex flex-col items-center justify-center gap-1 text-slate-500 hover:text-white hover:border-orange-500 transition-all"
                                    >
                                        <Upload size={20} />
                                        <span className="text-[9px] font-black uppercase">Subir Imagen</span>
                                        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                                    </button>
                                </div>

                                <div className="grid grid-cols-3 gap-2 mt-2">
                                    {PRESET_IMAGES.map((img, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setProdImage(img.url)}
                                            className={`aspect-square rounded-xl overflow-hidden border-2 transition-all ${prodImage === img.url ? 'border-orange-500' : 'border-transparent'}`}
                                        >
                                            <img src={img.url} className="w-full h-full object-cover" />
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Nombre del Producto</label>
                                    <input type="text" value={prodName} onChange={e => setProdName(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white font-bold outline-none" placeholder="Ej: Burger Triple" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Precio Venta (ARS $)</label>
                                    <input type="number" value={prodPrice} onChange={e => setProdPrice(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white font-bold outline-none" placeholder="0" />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-500 ml-2 block">Insumos Necesarios</label>
                                    <div className="max-h-48 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                        {ingredients.map(inv => {
                                            const selected = prodIngredients.find(i => i.ingredient_id === inv.id);
                                            return (
                                                <div key={inv.id} className={`p-3 rounded-2xl border transition-all flex items-center justify-between ${selected ? 'bg-orange-500/10 border-orange-500/50' : 'bg-slate-900/50 border-slate-800'}`}>
                                                    <div className="flex items-center gap-2 flex-1 cursor-pointer" onClick={() => toggleIngredient(inv.id)}>
                                                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${selected ? 'bg-orange-500 border-orange-500' : 'border-slate-700'}`}>
                                                            {selected && <Check size={10} className="text-white" />}
                                                        </div>
                                                        <span className="text-[10px] font-bold text-white">{inv.name}</span>
                                                    </div>
                                                    {selected && (
                                                        <div className="flex items-center gap-2">
                                                            <input type="number" value={selected.quantity_used} onChange={(e) => updateIngredientQty(inv.id, parseFloat(e.target.value) || 0)} className="w-12 bg-slate-800 border border-slate-700 rounded-lg p-1 text-[10px] text-center text-white" />
                                                            <span className="text-[9px] text-slate-500 uppercase">{inv.unit}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                            <button onClick={handleAddProduct} className="w-full py-5 bg-orange-600 text-white font-black rounded-2xl shadow-xl uppercase tracking-widest sticky bottom-0">Guardar Producto</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminTab;

