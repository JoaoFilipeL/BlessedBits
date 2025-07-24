"use client"
import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowDownIcon, ArrowUpIcon, DollarSign, TrendingDown, TrendingUp } from "lucide-react"
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';


type TransactionCategory = "venda" | "compra" | "salário" | "aluguel" | "outros";
type TransactionType = "receita" | "despesa";

interface Transaction {
    id: string;
    transaction_date: string; 
    description: string;
    category: TransactionCategory;
    amount: number;
    type: TransactionType;
    created_at: string;
}

export function FinancialSummary() {
    const [totalRevenue, setTotalRevenue] = useState(0);
    const [totalExpenses, setTotalExpenses] = useState(0);
    const [netProfit, setNetProfit] = useState(0);
    const [averageTicket, setAverageTicket] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const supabase = createClientComponentClient();

    const calculateSummary = useCallback((transactions: Transaction[]) => {
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();

        const transactionsThisMonth = transactions.filter(t => {
            const date = new Date(t.transaction_date + 'T00:00:00'); 
            return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
        });

        const revenue = transactionsThisMonth
            .filter(t => t.type === 'receita')
            .reduce((sum, t) => sum + t.amount, 0);

        const expenses = transactionsThisMonth
            .filter(t => t.type === 'despesa')
            .reduce((sum, t) => sum + t.amount, 0);

        const profit = revenue - expenses;

        const salesTransactions = transactionsThisMonth.filter(t => t.category === 'venda' && t.type === 'receita');
        const totalSalesAmount = salesTransactions.reduce((sum, t) => sum + t.amount, 0);
        const numberOfSales = salesTransactions.length;
        const avgTicket = numberOfSales > 0 ? totalSalesAmount / numberOfSales : 0;

        setTotalRevenue(revenue);
        setTotalExpenses(expenses);
        setNetProfit(profit);
        setAverageTicket(avgTicket);
    }, []);

    const fetchTransactionsAndCalculateSummary = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { data, error } = await supabase
                .from('financial_transactions')
                .select('*'); 

            if (error) {
                console.error("Erro ao buscar transações para resumo:", error);
                setError(error.message);
                return;
            }
            const fetchedTransactions: Transaction[] = data.map(item => ({
                id: item.id,
                transaction_date: item.transaction_date,
                description: item.description,
                category: item.category as TransactionCategory,
                amount: parseFloat(item.amount),
                type: item.type as TransactionType,
                created_at: item.created_at,
            }));
            calculateSummary(fetchedTransactions);
        } catch (err: any) {
            console.error("Erro inesperado ao buscar transações para resumo:", err);
            setError(err.message || "Erro ao carregar resumo financeiro.");
        } finally {
            setLoading(false);
        }
    }, [supabase, calculateSummary]);

    useEffect(() => {
        fetchTransactionsAndCalculateSummary(); 

        const channel = supabase
            .channel('financial_transactions_summary_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'financial_transactions' },
                (payload) => {
                    console.log('Mudança em transações para resumo em tempo real!', payload);
                    fetchTransactionsAndCalculateSummary(); 
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase, fetchTransactionsAndCalculateSummary]);


    return (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4"> 
            {loading ? (
                <div className="col-span-full text-center text-gray-500">Carregando resumo financeiro...</div>
            ) : error ? (
                <div className="col-span-full text-center text-red-500">Erro: {error}</div>
            ) : (
                <>
                    <Card className="w-full h-full flex flex-col justify-between"> 
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4"> 
                            <CardTitle className="text-sm font-medium">Receita Total (Mês)</CardTitle>
                            <DollarSign className="h-5 w-5 text-muted-foreground" /> 
                        </CardHeader>
                        <CardContent className="p-4 pt-0"> 
                            <div className="text-3xl font-bold">$ {totalRevenue.toFixed(2)}</div> 
                            <div className="flex items-center pt-1 text-xs text-green-600">
                                <ArrowUpIcon className="mr-1 h-3 w-3" />
                                <span>(Dados do mês atual)</span> 
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="w-full h-full flex flex-col justify-between"> 
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4"> 
                            <CardTitle className="text-sm font-medium">Despesas (Mês)</CardTitle>
                            <TrendingDown className="h-5 w-5 text-muted-foreground" /> 
                        </CardHeader>
                        <CardContent className="p-4 pt-0"> 
                            <div className="text-3xl font-bold">$ {totalExpenses.toFixed(2)}</div> 
                            <div className="flex items-center pt-1 text-xs text-red-600">
                                <ArrowDownIcon className="mr-1 h-3 w-3" />
                                <span>(Dados do mês atual)</span> 
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="w-full h-full flex flex-col justify-between"> 
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4"> 
                            <CardTitle className="text-sm font-medium">Lucro Líquido</CardTitle>
                            <TrendingUp className="h-5 w-5 text-muted-foreground" /> 
                        </CardHeader>
                        <CardContent className="p-4 pt-0"> 
                            <div className="text-3xl font-bold">$ {netProfit.toFixed(2)}</div> 
                            <div className="flex items-center pt-1 text-xs text-green-600">
                                <ArrowUpIcon className="mr-1 h-3 w-3" />
                                <span>(Dados do mês atual)</span> 
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="w-full h-full flex flex-col justify-between"> 
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4"> 
                            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
                            <DollarSign className="h-5 w-5 text-muted-foreground" /> 
                        </CardHeader>
                        <CardContent className="p-4 pt-0"> 
                            <div className="text-3xl font-bold">$ {averageTicket.toFixed(2)}</div> 
                            <div className="flex items-center pt-1 text-xs text-green-600">
                                <ArrowUpIcon className="mr-1 h-3 w-3" />
                                <span>(Dados do mês atual)</span> 
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    )
}
