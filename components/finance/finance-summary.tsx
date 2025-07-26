"use client"
import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowDownIcon, ArrowUpIcon, DollarSign, TrendingDown, TrendingUp } from "lucide-react"
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
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
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "../ui/button";


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

interface Receipt {
    id: string; 
    transaction_id: string; 
    file_path: string;
    uploaded_at: string; 
    file_name: string; 
    user_id: string;
}


export function FinancialSummary() {
    const [totalRevenue, setTotalRevenue] = useState(0);
    const [totalExpenses, setTotalExpenses] = useState(0);
    const [netProfit, setNetProfit] = useState(0);
    const [averageTicket, setAverageTicket] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const getTodayDate = () => {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const [isManageReceiptsDialogOpen, setIsManageReceiptsDialogOpen] = useState(false);
    const [newExpenseDescription, setNewExpenseDescription] = useState("");
    const [newExpenseAmount, setNewExpenseAmount] = useState("");
    const [newExpenseDate, setNewExpenseDate] = useState(getTodayDate()); 
    const [newExpenseCategory, setNewExpenseCategory] = useState<TransactionCategory>("compra"); 
    const [selectedReceiptFiles, setSelectedReceiptFiles] = useState<File[]>([]);
    const [uploadingReceipt, setUploadingReceipt] = useState(false);
    const [receiptUploadError, setReceiptUploadError] = useState<string | null>(null);
    const [receiptUploadSuccess, setReceiptUploadSuccess] = useState<string | null>(null);
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
                .eq('user_id', userId); 

            if (transactionsError) {
                console.error("Erro ao buscar transações para resumo:", transactionsError);
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
            }));
            calculateSummary(fetchedTransactions);

            const { data: receiptsData, error: receiptsError } = await supabase
                .from('receipt_images')
                .select('id') 
                .eq('user_id', userId); 

            if (receiptsError) {
                console.error("Erro ao buscar recibos:", receiptsError);
                setError(receiptsError.message);
                setLoading(false);
                return;
            }
            setReceipts(receiptsData as Receipt[]);


        } catch (err: any) {
            console.error("Erro inesperado ao buscar transações e recibos:", err);
            setError(err.message || "Erro ao carregar resumo financeiro e recibos.");
        } finally {
            setLoading(false);
        }
    }, [supabase, calculateSummary, getUserId]);

    useEffect(() => {
        fetchTransactionsAndReceipts(); 

        const channel = supabase
            .channel('financial_data_changes') 
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'financial_transactions' },
                (payload) => {
                    console.log('Mudança em transações financeiras em tempo real!', payload);
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

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            setSelectedReceiptFiles(Array.from(event.target.files));
            setReceiptUploadError(null);
            setReceiptUploadSuccess(null);
        }
    };

    const handleUploadReceiptAndExpense = async () => {
        const userId = await getUserId();
        if (!userId) {
            setReceiptUploadError("Usuário não autenticado. Por favor, faça login.");
            return;
        }

        const amount = parseFloat(newExpenseAmount);
        if (!newExpenseDescription || isNaN(amount) || amount <= 0 || !newExpenseDate) {
            setReceiptUploadError("Por favor, preencha a descrição, valor e data da despesa corretamente.");
            return;
        }

        setUploadingReceipt(true);
        setReceiptUploadError(null);
        setReceiptUploadSuccess(null);

        try {
            const { data: transactionData, error: transactionError } = await supabase
                .from('financial_transactions')
                .insert({
                    description: newExpenseDescription,
                    amount: amount,
                    transaction_date: newExpenseDate,
                    category: newExpenseCategory,
                    type: "despesa", 
                    user_id: userId,
                })
                .select()
                .single();

            if (transactionError) throw transactionError;

            const uploadedReceipts: Omit<Receipt, 'id'>[] = [];
            for (const file of selectedReceiptFiles) {
                const filePath = `${userId}/${transactionData.id}/${Date.now()}_${file.name}`;
                const { error: uploadError } = await supabase.storage
                    .from('receipts') 
                    .upload(filePath, file, {
                        cacheControl: '3600',
                        upsert: false,
                    });

                if (uploadError) {
                    if (uploadError.message.includes("Bucket not found")) {
                        throw new Error("Bucket 'receipts' não encontrado no Supabase Storage. Por favor, crie-o.");
                    }
                    throw uploadError;
                }

                uploadedReceipts.push({
                    transaction_id: transactionData.id,
                    file_path: filePath, 
                    uploaded_at: new Date().toISOString(), 
                    file_name: file.name,
                    user_id: userId,
                });
            }

            if (uploadedReceipts.length > 0) {
                const { error: receiptInsertError } = await supabase
                    .from('receipt_images')
                    .insert(uploadedReceipts);

                if (receiptInsertError) throw receiptInsertError;
            }

            setReceiptUploadSuccess("Despesa e recibo(s) registrados com sucesso!");
            setNewExpenseDescription("");
            setNewExpenseAmount("");
            setNewExpenseDate(getTodayDate()); 
            setNewExpenseCategory("compra"); 
            setSelectedReceiptFiles([]);
            setIsManageReceiptsDialogOpen(false); 

            fetchTransactionsAndReceipts();

        } catch (err: any) {
            console.error("Erro ao registrar despesa ou fazer upload do recibo:", err);
            setReceiptUploadError(err.message || "Erro ao registrar despesa ou fazer upload do recibo.");
        } finally {
            setUploadingReceipt(false);
        }
    };

    const handleViewReceipt = async (receipt: Receipt) => {
        const userId = await getUserId();
        if (!userId) {
            setReceiptUploadError("Usuário não autenticado.");
            return;
        }
        try {
            const { data, error } = await supabase.storage
                .from('receipts')
                .createSignedUrl(receipt.file_path, 3600); 

            if (error) throw error;
            
            setCurrentImageUrl(data.signedUrl);
            setIsImageViewerOpen(true);

        } catch (err: any) {
            console.error("Erro ao gerar URL do recibo:", err);
            setReceiptUploadError(err.message || "Erro ao visualizar recibo.");
        }
    };


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
                    <Dialog open={isManageReceiptsDialogOpen} onOpenChange={setIsManageReceiptsDialogOpen}>
                        <DialogTrigger asChild>
                            <Card className="w-full h-full flex flex-col justify-between cursor-pointer hover:bg-gray-50 transition-colors"> 
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4"> 
                                    <CardTitle className="text-sm font-medium">Recibos</CardTitle> 
                                    <DollarSign className="h-5 w-5 text-muted-foreground" /> 
                                </CardHeader>
                                <CardContent className="p-4 pt-0"> 
                                    <div className="text-3xl font-bold">{receipts.length}</div> 
                                    <div className="flex items-center pt-1 text-xs text-green-600">
                                        <ArrowUpIcon className="mr-1 h-3 w-3" />
                                        <span>(Clique para gerenciar recibos)</span> 
                                    </div>
                                </CardContent>
                            </Card>
                        </DialogTrigger>
                        <DialogContent className="max-w-md w-[90%]">
                            <DialogHeader>
                                <DialogTitle>Adicionar Nova Despesa</DialogTitle> 
                                <DialogDescription>Adicione os detalhes da despesa e, opcionalmente, o recibo.</DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4 overflow-y-auto max-h-[70vh] pr-4">
                                <div className="space-y-4"> 
                                    {receiptUploadError && (
                                        <div className="bg-red-100 text-red-700 p-3 rounded-md text-sm">
                                            {receiptUploadError}
                                        </div>
                                    )}
                                    {receiptUploadSuccess && (
                                        <div className="bg-green-100 text-green-700 p-3 rounded-md text-sm">
                                            {receiptUploadSuccess}
                                        </div>
                                    )}
                                    <div className="grid gap-2">
                                        <Label htmlFor="expenseDescription">Descrição da Despesa</Label>
                                        <Input
                                            id="expenseDescription"
                                            value={newExpenseDescription}
                                            onChange={(e) => setNewExpenseDescription(e.target.value)}
                                            placeholder="Ex: Compra de ingredientes"
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="expenseAmount">Valor ($)</Label>
                                        <Input
                                            id="expenseAmount"
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={newExpenseAmount}
                                            onChange={(e) => setNewExpenseAmount(e.target.value)}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="expenseDate">Data da Despesa</Label>
                                        <Input
                                            id="expenseDate"
                                            type="date"
                                            value={newExpenseDate}
                                            onChange={(e) => setNewExpenseDate(e.target.value)}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="expenseCategory">Categoria</Label>
                                        <Select value={newExpenseCategory} onValueChange={(value: TransactionCategory) => setNewExpenseCategory(value)}>
                                            <SelectTrigger id="expenseCategory">
                                                <SelectValue placeholder="Selecione uma categoria" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="compra">Compra</SelectItem>
                                                <SelectItem value="outros">Outros</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="receiptFiles">Anexar Recibo(s) (opcional)</Label>
                                        <Input
                                            id="receiptFiles"
                                            type="file"
                                            multiple
                                            onChange={handleFileSelect}
                                            accept="image/*,application/pdf" 
                                        />
                                        {selectedReceiptFiles.length > 0 && (
                                            <div className="mt-2 text-sm text-gray-500">
                                                {selectedReceiptFiles.map(file => file.name).join(", ")}
                                            </div>
                                        )}
                                    </div>
                                    <DialogFooter className="mt-4">
                                        <Button onClick={handleUploadReceiptAndExpense} disabled={uploadingReceipt || !newExpenseDescription || !newExpenseAmount || !newExpenseDate}>
                                            {uploadingReceipt ? "Registrando..." : "Salvar Despesa e Recibo"}
                                        </Button>
                                    </DialogFooter>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsManageReceiptsDialogOpen(false)}>
                                    Fechar
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </>
            )}

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
