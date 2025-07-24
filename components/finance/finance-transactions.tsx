"use client"
import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Search, Plus, Filter, Trash2 } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

type TransactionCategory = "venda" | "compra" | "outros";
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

const typeColors: Record<string, string> = {
    receita: "bg-green-100 text-green-800 hover:bg-green-200",
    despesa: "bg-red-100 text-red-800 hover:bg-red-200",
}

const statusColors: Record<string, string> = {
    "em análise": "bg-yellow-100 text-yellow-800 hover:bg-yellow-200",
    "em produção": "bg-blue-100 text-blue-800 hover:bg-blue-200",
    pronto: "bg-green-100 text-green-800 hover:bg-green-200",
    cancelado: "bg-red-100 text-red-800 hover:bg-red-200", 
}


export function FinancialTransactions() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [filter, setFilter] = useState<"todos" | TransactionType>("todos");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [newDescription, setNewDescription] = useState("");
    const [newCategory, setNewCategory] = useState<TransactionCategory>("venda");
    const [newAmount, setNewAmount] = useState("");
    const [newType, setNewType] = useState<TransactionType>("receita");
    const [newDate, setNewDate] = useState(new Date().toISOString().split("T")[0]);

    const supabase = createClientComponentClient();

    const fetchTransactions = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { data, error } = await supabase
                .from('financial_transactions')
                .select('*')
                .order('transaction_date', { ascending: false })
                .order('created_at', { ascending: false });

            if (error) {
                console.error("Erro ao buscar transações:", error);
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
            setTransactions(fetchedTransactions);
        } catch (err: any) {
            console.error("Erro inesperado ao buscar transações:", err);
            setError(err.message || "Erro ao carregar transações.");
        } finally {
            setLoading(false);
        }
    }, [supabase]);

    useEffect(() => {
        fetchTransactions();

        const channel = supabase
            .channel('financial_transactions_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'financial_transactions' },
                (payload) => {
                    console.log('Mudança em transações em tempo real!', payload);
                    fetchTransactions();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase, fetchTransactions]);

    const filteredTransactions = transactions.filter(
        (transaction) =>
            (transaction.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                transaction.category.toLowerCase().includes(searchTerm.toLowerCase())) &&
            (filter === "todos" || transaction.type === filter),
    );

    const addNewTransaction = async () => {
        const amount = Number.parseFloat(newAmount);

        if (!newDescription || isNaN(amount) || amount <= 0) {
            console.error("Por favor, preencha a descrição e um valor válido para a transação.");
            setError("Por favor, preencha a descrição e um valor válido para a transação.");
            return;
        }

        try {
            const { error } = await supabase
                .from('financial_transactions')
                .insert([
                    {
                        transaction_date: newDate,
                        description: newDescription,
                        category: newCategory,
                        amount: amount,
                        type: newType,
                    },
                ]);

            if (error) {
                console.error("Erro ao adicionar nova transação:", error);
                setError(error.message);
                return;
            }

            setNewDescription("");
            setNewCategory("venda");
            setNewAmount("");
            setNewType("receita");
            setNewDate(new Date().toISOString().split("T")[0]);
            setIsAddDialogOpen(false);
            setError(null);
        } catch (err: any) {
            console.error("Erro inesperado ao adicionar transação:", err);
            setError(err.message || "Erro ao adicionar transação.");
        }
    };

    const handleDeleteTransaction = async (transactionId: string) => {
        if (!confirm("Tem certeza que deseja excluir esta transação?")) {
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const { error } = await supabase
                .from('financial_transactions')
                .delete()
                .eq('id', transactionId);

            if (error) {
                console.error("Erro ao excluir transação:", error);
                setError(error.message);
            }
        } catch (err: any) {
            console.error("Erro inesperado ao excluir transação:", err);
            setError(err.message || "Erro ao excluir transação.");
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString + 'T00:00:00');
        return date.toLocaleDateString("pt-BR");
    };

    return (
        <div className="space-y-4">
            {loading && <div className="text-center text-gray-500">Carregando transações...</div>}
            {error && <div className="text-center text-red-500">Erro: {error}</div>}

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h2 className="text-xl font-semibold">Transações</h2>
                    <Badge variant="outline" className="ml-2">
                        {filteredTransactions.length} transações
                    </Badge>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Buscar transações..."
                            className="pl-8 w-[250px]"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline">
                                <Filter className="mr-2 h-4 w-4" />
                                {filter === "todos" ? "Todos" : filter === "receita" ? "Receitas" : "Despesas"}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setFilter("todos")}>Todos</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setFilter("receita")}>Receitas</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setFilter("despesa")}>Despesas</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="mr-2 h-4 w-4" />
                                Nova Transação
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Adicionar Nova Transação</DialogTitle>
                                <DialogDescription>Registre uma nova transação financeira</DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="type">Tipo</Label>
                                    <Select value={newType} onValueChange={(value: TransactionType) => setNewType(value)}>
                                        <SelectTrigger id="type">
                                            <SelectValue placeholder="Selecione o tipo" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="receita">Receita</SelectItem>
                                            <SelectItem value="despesa">Despesa</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="description">Descrição</Label>
                                    <Input
                                        id="description"
                                        value={newDescription}
                                        onChange={(e) => setNewDescription(e.target.value)}
                                        placeholder="Ex: Vendas do dia"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="category">Categoria</Label>
                                    <Select value={newCategory} onValueChange={(value: TransactionCategory) => setNewCategory(value)}>
                                        <SelectTrigger id="category">
                                            <SelectValue placeholder="Selecione a categoria" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="venda">Venda</SelectItem>
                                            <SelectItem value="compra">Compra</SelectItem>
                                            <SelectItem value="outros">Outros</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="amount">Valor ($)</Label>
                                        <Input
                                            id="amount"
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={newAmount}
                                            onChange={(e) => setNewAmount(e.target.value)}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="date">Data</Label>
                                        <Input id="date" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
                                    </div>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                                    Cancelar
                                </Button>
                                <Button onClick={addNewTransaction}>Adicionar</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Data</TableHead>
                            <TableHead>Descrição</TableHead>
                            <TableHead>Categoria</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">
                                    Carregando dados...
                                </TableCell>
                            </TableRow>
                        ) : error ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center text-red-500">
                                    {error}
                                </TableCell>
                            </TableRow>
                        ) : filteredTransactions.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">
                                    Nenhuma transação encontrada.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredTransactions.map((transaction) => (
                                <TableRow key={transaction.id}>
                                    <TableCell>{formatDate(transaction.transaction_date)}</TableCell>
                                    <TableCell className="font-medium">{transaction.description}</TableCell>
                                    <TableCell className="capitalize">{transaction.category}</TableCell>
                                    <TableCell>
                                        {transaction.description.startsWith('Cancelamento do Pedido') ? (
                                            <Badge variant="outline" className={statusColors.cancelado}>
                                                Cancelado
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className={typeColors[transaction.type]}>
                                                {transaction.type === "receita" ? "Receita" : "Despesa"}
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <span className={

                                            transaction.description.startsWith('Cancelamento do Pedido')
                                                ? "text-red-600"
                                                : (transaction.type === "receita" ? "text-green-600" : "text-red-600")
                                        }>
                                            {transaction.amount < 0 ? "-" : "+"}
                                            $ {Math.abs(transaction.amount).toFixed(2)}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDeleteTransaction(transaction.id)}
                                            className="text-red-500 hover:text-red-600"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
