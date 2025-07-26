"use client"
import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ShoppingBag, DollarSign, Package, Clock, ArrowUpIcon, ArrowDownIcon, TrendingUp, TrendingDown } from "lucide-react"
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

type OrderStatus = "em análise" | "em produção" | "pronto" | "cancelado";
type TransactionType = "receita" | "despesa";
type TransactionCategory = "venda" | "compra" | "outros";

interface Order {
    id: string;
    status: OrderStatus;
    total_amount: number;
    created_at: string;
}

interface Transaction {
    id: string;
    transaction_date: string;
    amount: number;
    type: TransactionType;
    category: TransactionCategory;
}

interface StockItem {
    id: string;
    quantity: number;
    min_quantity: number;
}

export function DashboardStats() {
    const [ordersToday, setOrdersToday] = useState(0);
    const [revenueToday, setRevenueToday] = useState(0);
    const [lowStockProducts, setLowStockProducts] = useState(0); 
    const [monthlyRevenue, setMonthlyRevenue] = useState(0); 
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const supabase = createClientComponentClient();

    const fetchDashboardData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(today.getDate() + 1);

            const todayISO = today.toISOString();
            const tomorrowISO = tomorrow.toISOString();

            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0); 
            endOfMonth.setHours(23, 59, 59, 999); 
            const startOfMonthISO = startOfMonth.toISOString();
            const endOfMonthISO = endOfMonth.toISOString();


            const { data: ordersData, error: ordersError } = await supabase
                .from('orders')
                .select('id, status, total_amount, created_at')
                .gte('created_at', todayISO)
                .lt('created_at', tomorrowISO);

            if (ordersError) throw ordersError;

            const ordersCountToday = ordersData.filter(
                order => order.status === 'em produção' || order.status === 'pronto'
            ).length;
            setOrdersToday(ordersCountToday);

            const revenueSumToday = ordersData.filter(order => order.status === 'pronto')
                .reduce((sum, order) => sum + parseFloat(order.total_amount.toString()), 0);
            setRevenueToday(revenueSumToday);

            const { data: stockData, error: stockError } = await supabase
                .from('stock')
                .select('quantity, min_quantity');

            if (stockError) throw stockError;

            const lowStockCount = stockData.filter(item => item.quantity <= item.min_quantity).length;
            setLowStockProducts(lowStockCount);

            const { data: transactionsData, error: transactionsError } = await supabase
                .from('financial_transactions')
                .select('amount, type, transaction_date')
                .gte('transaction_date', startOfMonthISO.split('T')[0]) 
                .lte('transaction_date', endOfMonthISO.split('T')[0]); 

            if (transactionsError) throw transactionsError;

            const monthlyRevenueSum = transactionsData
                .filter(t => t.type === 'receita')
                .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);

            setMonthlyRevenue(monthlyRevenueSum);


        } catch (err: any) {
            console.error("Erro ao buscar dados do Dashboard:", err);
            setError(err.message || "Erro ao carregar dados do dashboard.");
        } finally {
            setLoading(false);
        }
    }, [supabase]);

    useEffect(() => {
        fetchDashboardData();

        const ordersChannel = supabase
            .channel('dashboard_orders_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'orders' },
                (payload) => {
                    console.log('Mudança em pedidos para dashboard em tempo real!', payload);
                    fetchDashboardData();
                }
            )
            .subscribe();

        const financialChannel = supabase
            .channel('dashboard_financial_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'financial_transactions' },
                (payload) => {
                    console.log('Mudança em finanças para dashboard em tempo real!', payload);
                    fetchDashboardData();
                }
            )
            .subscribe();

        const stockChannel = supabase
            .channel('dashboard_stock_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'stock' },
                (payload) => {
                    console.log('Mudança no estoque para dashboard em tempo real!', payload);
                    fetchDashboardData();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(ordersChannel);
            supabase.removeChannel(financialChannel); 
            supabase.removeChannel(stockChannel); 
        };
    }, [supabase, fetchDashboardData]);

    return (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4">
            {loading ? (
                <div className="col-span-full text-center text-gray-500">Carregando estatísticas...</div>
            ) : error ? (
                <div className="col-span-full text-center text-red-500">Erro: {error}</div>
            ) : (
                <>
                    <Card className="w-full h-full flex flex-col justify-between">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4">
                            <CardTitle className="text-sm font-medium">Pedidos Hoje</CardTitle>
                            <ShoppingBag className="h-5 w-5 text-muted-foreground" />
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                            <div className="text-3xl font-bold">{ordersToday}</div>
                            <p className="text-xs text-muted-foreground mt-1">+18% em relação a ontem</p>
                        </CardContent>
                    </Card>
                    <Card className="w-full h-full flex flex-col justify-between">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4">
                            <CardTitle className="text-sm font-medium">Faturamento Hoje</CardTitle>
                            <DollarSign className="h-5 w-5 text-muted-foreground" />
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                            <div className="text-3xl font-bold">$ {revenueToday.toFixed(2)}</div>
                            <p className="text-xs text-muted-foreground mt-1">+12% em relação a ontem</p>
                        </CardContent>
                    </Card>
                    <Card className="w-full h-full flex flex-col justify-between">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4">
                            <CardTitle className="text-sm font-medium">Estoque Baixo</CardTitle> 
                            <Package className="h-5 w-5 text-muted-foreground" /> 
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                            <div className="text-3xl font-bold">{lowStockProducts}</div> 
                            <p className="text-xs text-muted-foreground mt-1">Produtos com estoque crítico</p> 
                        </CardContent>
                    </Card>
                    <Card className="w-full h-full flex flex-col justify-between">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4">
                            <CardTitle className="text-sm font-medium">Receita Total (Mês)</CardTitle>
                            <TrendingUp className="h-5 w-5 text-muted-foreground" />
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                            <div className="text-3xl font-bold">$ {monthlyRevenue.toFixed(2)}</div>
                            <p className="text-xs text-muted-foreground mt-1">Dados do mês atual</p>
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    )
}
