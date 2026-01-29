import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Category, Product, Ingredient, Order, Profile, Expense, ProductIngredient, AppNotification } from '@/types/database'

export function useRealtimeData() {
    const [categories, setCategories] = useState<Category[]>([])
    const [products, setProducts] = useState<Product[]>([])
    const [ingredients, setIngredients] = useState<Ingredient[]>([])
    const [orders, setOrders] = useState<Order[]>([])
    const [expenses, setExpenses] = useState<Expense[]>([])
    const [notifications, setNotifications] = useState<AppNotification[]>([])
    const [productIngredients, setProductIngredients] = useState<ProductIngredient[]>([])

    const fetchData = async () => {
        try {
            const { data: catData } = await supabase.from('categories').select('*')
            const { data: prodData } = await supabase.from('products').select('*, category:categories(*)')
            const { data: ingData } = await supabase.from('ingredients').select('*')
            const { data: ordData } = await supabase.from('orders').select('*, items:order_items(*)').order('created_at', { ascending: false })
            const { data: expData } = await supabase.from('expenses').select('*').order('date', { ascending: false })
            const { data: piData } = await supabase.from('product_ingredients').select('*')
            const { data: notifData } = await supabase.from('app_notifications').select('*').order('created_at', { ascending: false }).limit(50)

            if (catData) {
                setCategories(catData)
                localStorage.setItem('cache_categories', JSON.stringify(catData))
            }
            if (prodData) {
                setProducts(prodData)
                localStorage.setItem('cache_products', JSON.stringify(prodData))
            }
            if (ingData) {
                setIngredients(ingData)
                localStorage.setItem('cache_ingredients', JSON.stringify(ingData))
            }
            if (ordData) setOrders(ordData)
            if (expData) setExpenses(expData)
            if (piData) setProductIngredients(piData)
            if (notifData) setNotifications(notifData)
        } catch (err) {
            console.log('Using offline cache...');
            const cCat = localStorage.getItem('cache_categories')
            const cProd = localStorage.getItem('cache_products')
            const cIng = localStorage.getItem('cache_ingredients')
            if (cCat) setCategories(JSON.parse(cCat))
            if (cProd) setProducts(JSON.parse(cProd))
            if (cIng) setIngredients(JSON.parse(cIng))
        }
    }

    useEffect(() => {
        fetchData()

        const handlePayload = (payload: any) => {
            console.log('Postgres Change Received:', payload.table, payload.eventType, payload);
            fetchData();
        };

        const channel = supabase
            .channel('db-changes')
            .on('postgres_changes', { event: '*', schema: 'public' }, handlePayload)
            .subscribe((status, err) => {
                if (err) {
                    console.error('REALTIME ERROR:', err);
                }
                console.log('REALTIME STATUS:', status);
            })

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    return { categories, products, ingredients, orders, expenses, productIngredients, notifications, setOrders }
}

