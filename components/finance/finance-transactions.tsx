"use client"
import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Search, Plus, Filter, Trash2, Eye } from "lucide-react" 
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
    user_id?: string; 
}

interface Receipt {
    id: string; 
    transaction_id: string; 
    file_path: string;
    uploaded_at: string; 
    file_name: string; 
    user_id: string;
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

    const getTodayDate = () => {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const [newDescription, setNewDescription] = useState("");
    const [newCategory, setNewCategory] = useState<TransactionCategory>("venda");
    const [newAmount, setNewAmount] = useState("");
    const [newType, setNewType] = useState<TransactionType>("receita");
    const [newDate, setNewDate] = useState(getTodayDate()); 

    const [receipts, setReceipts] = useState<Receipt[]>([]); 

    const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
    const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);


    const supabase = createClientComponentClient();

    const getUserId = useCallback(async () => {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
            console.error("Erro ao obter sessão do usuário:", sessionError);
            return null;
        }
        return session?.user?.id || null;
    }, [supabase]);

    const fetchTransactionsAndReceipts = useCallback(async () => { 
        setLoading(true);
        setError(null);
        try {
            const userId = await getUserId();
            if (!userId) {
                setError("Usuário não autenticado para buscar dados.");
                setLoading(false);
                return;
            }

            const { data: transactionsData, error: transactionsError } = await supabase
                .from('financial_transactions')
                .select('*')
                .eq('user_id', userId) 
                .order('transaction_date', { ascending: false })
                .order('created_at', { ascending: false });

            if (transactionsError) {
                console.error("Erro ao buscar transações:", transactionsError);
                setError(transactionsError.message);
                setLoading(false);
                return;
            }

            const fetchedTransactions: Transaction[] = transactionsData.map(item => ({
                id: item.id,
                transaction_date: item.transaction_date,
                description: item.description,
                category: item.category as TransactionCategory,
                amount: parseFloat(item.amount),
                type: item.type as TransactionType,
                created_at: item.created_at,
                user_id: item.user_id,
            }));
            setTransactions(fetchedTransactions);

            const { data: receiptsData, error: receiptsError } = await supabase
                .from('receipt_images')
                .select('*')
                .eq('user_id', userId) 
                .order('uploaded_at', { ascending: false });

            if (receiptsError) {
                console.error("Erro ao buscar recibos:", receiptsError);
                setError(receiptsError.message);
                setLoading(false);
                return;
            }
            setReceipts(receiptsData as Receipt[]);

        } catch (err: any) {
            console.error("Erro inesperado ao buscar transações e recibos:", err);
            setError(err.message || "Erro ao carregar transações e recibos.");
        } finally {
            setLoading(false);
        }
    }, [supabase, getUserId]);

    useEffect(() => {
        fetchTransactionsAndReceipts();

        const channel = supabase
            .channel('financial_transactions_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'financial_transactions' },
                (payload) => {
                    console.log('Mudança em transações em tempo real!', payload);
                    fetchTransactionsAndReceipts();
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'receipt_images' }, 
                (payload) => {
                    console.log('Mudança em recibos em tempo real!', payload);
                    fetchTransactionsAndReceipts();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase, fetchTransactionsAndReceipts]);

    const filteredTransactions = transactions.filter(
        (transaction) =>
            (transaction.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                transaction.category.toLowerCase().includes(searchTerm.toLowerCase())) &&
            (filter === "todos" || transaction.type === filter),
    );


    const addNewTransaction = async () => {
        const userId = await getUserId();
        if (!userId) {
            setError("Usuário não autenticado. Por favor, faça login.");
            return;
        }

        const amount = Number.parseFloat(newAmount);

        if (!newDescription || isNaN(amount) || amount <= 0) {
            console.error("Por favor, preencha a descrição e um valor válido para a transação.");
            setError("Por favor, preencha a descrição e um valor válido para a transação.");
            return;
        }


        try {
            const { error: transactionError } = await supabase
                .from('financial_transactions')
                .insert([
                    {
                        transaction_date: newDate,
                        description: newDescription,
                        category: newCategory,
                        amount: amount,
                        type: newType,
                        user_id: userId, 
                    },
                ]);

            if (transactionError) throw transactionError;

      
            setNewDescription("");
            setNewCategory("venda");
            setNewAmount("");
            setNewType("receita");
            setNewDate(getTodayDate()); 
            setIsAddDialogOpen(false); 
            setError(null); 
        } catch (err: any) {
            console.error("Erro ao adicionar transação:", err); 
            setError(err.message || "Erro ao adicionar transação."); 
        } finally {
          
        }
    };

    const handleDeleteTransaction = async (transactionId: string) => {
        if (!confirm("Tem certeza que deseja excluir esta transação?")) {
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const { data: associatedReceipts, error: fetchReceiptsError } = await supabase
                .from('receipt_images')
                .select('id, file_path')
                .eq('transaction_id', transactionId);

            if (fetchReceiptsError) {
                console.error("Erro ao buscar recibos associados:", fetchReceiptsError);
                throw fetchReceiptsError;
            }

            if (associatedReceipts && associatedReceipts.length > 0) {
                const filePathsToDelete = associatedReceipts.map(r => r.file_path);
                const { error: deleteStorageError } = await supabase.storage
                    .from('receipts')
                    .remove(filePathsToDelete);

                if (deleteStorageError) {
                    console.error("Erro ao deletar arquivos do Storage:", deleteStorageError);
                }

                const { error: deleteReceiptsDbError } = await supabase
                    .from('receipt_images')
                    .delete()
                    .eq('transaction_id', transactionId);

                if (deleteReceiptsDbError) {
                    console.error("Erro ao deletar registros de recibo do DB:", deleteReceiptsDbError);
                }
            }
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
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0'); 
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    const handleViewReceipt = async (transactionId: string) => {
        const userId = await getUserId();
        if (!userId) {
            setError("Usuário não autenticado."); 
            return;
        }
        try {
            const { data: receiptData, error: fetchReceiptError } = await supabase
                .from('receipt_images')
                .select('file_path')
                .eq('transaction_id', transactionId)
                .eq('user_id', userId)
                .single();

            if (fetchReceiptError || !receiptData) {
                setError("Recibo não encontrado para esta transação.");
                return;
            }

            const { data, error: signedUrlError } = await supabase.storage
                .from('receipts')
                .createSignedUrl(receiptData.file_path, 3600); 

            if (signedUrlError) throw signedUrlError;
            
            setCurrentImageUrl(data.signedUrl);
            setIsImageViewerOpen(true);

        } catch (err: any) {
            console.error("Erro ao gerar URL do recibo:", err);
            setError(err.message || "Erro ao visualizar recibo.");
        }
    };


    return (
        <div className="space-y-4 p-4 md:p-6 lg:p-8"> 
            {loading && <div className="text-center text-gray-500">Carregando transações...</div>}
            {error && <div className="text-center text-red-500">Erro: {error}</div>}

            <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-4"> 
                <div className="flex items-center gap-2 flex-wrap"> 
                    <h2 className="text-xl font-semibold">Transações</h2>
                    <Badge variant="outline" className="ml-2">
                        {filteredTransactions.length} transações
                    </Badge>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
                    <div className="relative w-full sm:w-auto">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Buscar transações..."
                            className="pl-8 w-full sm:w-[250px]"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="w-full sm:w-auto"> 
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
                            <Button className="w-full sm:w-auto"> 
                                <Plus className="mr-2 h-4 w-4" />
                                Nova Transação
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md w-[90%]">
                            <DialogHeader>
                                <DialogTitle>Adicionar Nova Transação</DialogTitle>
                                <DialogDescription>Registre uma nova transação financeira</DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4 overflow-y-auto max-h-[70vh] pr-4"> 
                                {error && ( 
                                    <div className="bg-red-100 text-red-700 p-3 rounded-md text-sm">
                                        {error}
                                    </div>
                                )}
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
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"> 
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
                                <Button onClick={addNewTransaction}>
                                    Adicionar Transação
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>
            <div className="rounded-md border overflow-x-auto"> 
                <Table className="min-w-full">
                    <TableHeader>
                        <TableRow>
                            <TableHead className="min-w-[100px]">Data</TableHead> 
                            <TableHead className="min-w-[150px]">Descrição</TableHead> 
                            <TableHead className="hidden sm:table-cell min-w-[100px]">Categoria</TableHead> 
                            <TableHead className="min-w-[80px]">Tipo</TableHead> 
                            <TableHead className="text-right min-w-[100px]">Valor</TableHead> 
                            <TableHead className="text-right min-w-[80px]">Ações</TableHead> 
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
                                    <TableCell className="capitalize hidden sm:table-cell">{transaction.category}</TableCell>
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
                                        {transaction.type === "despesa" && receipts.some(r => r.transaction_id === transaction.id) && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleViewReceipt(transaction.id)}
                                                className="text-blue-500 hover:text-blue-600 mr-2"
                                                title="Ver Recibo"
                                            >
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                        )}
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
            <Dialog open={isImageViewerOpen} onOpenChange={setIsImageViewerOpen}>
                <DialogContent className="max-w-3xl w-[95%] h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Visualizar Recibo</DialogTitle>
                        <DialogDescription>Visualização do recibo.</DialogDescription>
                    </DialogHeader>
                    <div className="flex-grow flex items-center justify-center overflow-hidden">
                        {currentImageUrl && (
                            <img src={currentImageUrl} alt="Recibo" className="max-w-full max-h-full object-contain" />
                        )}
                    </div>
                    <DialogFooter>
                        <Button onClick={() => setIsImageViewerOpen(false)}>Fechar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
