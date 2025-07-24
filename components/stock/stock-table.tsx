"use client"
import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Search, Plus, RefreshCw, Trash2 } from "lucide-react" // Adicionado Trash2
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
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

interface StockItem {
    id: string
    name: string
    quantity: number
    unit: string
    minQuantity: number
    status: "ok" | "baixo" | "crítico" 
    price: number
}

const statusColors: Record<string, string> = {
    ok: "bg-green-100 text-green-800 hover:bg-green-200",
    baixo: "bg-yellow-100 text-yellow-800 hover:bg-yellow-200",
    crítico: "bg-red-100 text-red-800 hover:bg-red-200",
}

export function StockTable() {
    const [stock, setStock] = useState<StockItem[]>([]) 
    const [searchTerm, setSearchTerm] = useState("")
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false)
    const [selectedItem, setSelectedItem] = useState<StockItem | null>(null)
    const [loading, setLoading] = useState(true); 
    const [error, setError] = useState<string | null>(null); 
    const [newItemName, setNewItemName] = useState("")
    const [newItemQuantity, setNewItemQuantity] = useState("")
    const [newItemUnit, setNewItemUnit] = useState("un") 
    const [newItemMinQuantity, setNewItemMinQuantity] = useState("")
    const [newItemPrice, setNewItemPrice] = useState("")
    const [updateQuantity, setUpdateQuantity] = useState("")
    const supabase = createClientComponentClient();

    const calculateStatus = useCallback((quantity: number, minQuantity: number): StockItem['status'] => {
        if (quantity <= minQuantity * 0.3) {
            return "crítico";
        } else if (quantity <= minQuantity) {
            return "baixo";
        }
        return "ok";
    }, []);

    const fetchStock = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { data, error } = await supabase
                .from('stock')
                .select('*') 
                .order('name', { ascending: true }); 

            if (error) {
                console.error("Erro ao buscar estoque:", error);
                setError(error.message);
                return;
            }

            const fetchedStock: StockItem[] = data.map(item => ({
                id: item.id,
                name: item.name,
                quantity: item.quantity,
                unit: item.unit,
                minQuantity: item.min_quantity, 
                status: calculateStatus(item.quantity, item.min_quantity), 
                price: parseFloat(item.price), 
            }));
            setStock(fetchedStock);
        } catch (err: any) {
            console.error("Erro inesperado ao buscar estoque:", err);
            setError(err.message || "Erro ao carregar estoque.");
        } finally {
            setLoading(false);
        }
    }, [supabase, calculateStatus]);

    useEffect(() => {
        fetchStock(); 

        const channel = supabase
            .channel('stock_changes') 
            .on(
                'postgres_changes', 
                { event: '*', schema: 'public', table: 'stock' }, 
                (payload) => {
                    console.log('Mudança recebida em tempo real!', payload);
                    fetchStock();
                }
            )
            .subscribe(); 

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase, fetchStock]); 

    const filteredStock = stock.filter((item) =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const addNewItem = async () => {
        const quantity = Number.parseFloat(newItemQuantity);
        const minQuantity = Number.parseFloat(newItemMinQuantity);
        const price = Number.parseFloat(newItemPrice);

        if (!newItemName || isNaN(quantity) || isNaN(minQuantity) || isNaN(price) || quantity < 0 || minQuantity < 0 || price < 0) {
            console.error("Por favor, preencha todos os campos corretamente e com valores válidos.");
            setError("Por favor, preencha todos os campos corretamente e com valores válidos.");
            return;
        }

        try {
            const { error } = await supabase
                .from('stock')
                .insert([
                    {
                        name: newItemName,
                        quantity: quantity,
                        unit: newItemUnit,
                        min_quantity: minQuantity, 
                        price: price,
                    },
                ]);

            if (error) {
                console.error("Erro ao adicionar novo item:", error);
                setError(error.message);
                return;
            }

            setNewItemName("");
            setNewItemQuantity("");
            setNewItemUnit("un");
            setNewItemMinQuantity("");
            setNewItemPrice("");
            setIsAddDialogOpen(false);
            setError(null); 
        } catch (err: any) {
            console.error("Erro inesperado ao adicionar item:", err);
            setError(err.message || "Erro ao adicionar item.");
        }
    };

    const updateItemQuantity = async () => {
        if (!selectedItem) return;

        const newQuantity = Number.parseFloat(updateQuantity);

        if (isNaN(newQuantity) || newQuantity < 0) {
            console.error("Por favor, insira uma quantidade válida.");
            setError("Por favor, insira uma quantidade válida.");
            return;
        }

        try {
            const { error } = await supabase
                .from('stock')
                .update({
                    quantity: newQuantity,
                })
                .eq('id', selectedItem.id);

            if (error) {
                console.error("Erro ao atualizar quantidade do item:", error);
                setError(error.message);
                return;
            }

            setIsUpdateDialogOpen(false);
            setSelectedItem(null);
            setUpdateQuantity("");
            setError(null); 
        } catch (err: any) {
            console.error("Erro inesperado ao atualizar quantidade:", err);
            setError(err.message || "Erro ao atualizar quantidade.");
        }
    };

    const handleDeleteProduct = async (productId: string) => {
        if (!confirm("Tem certeza que deseja excluir este produto do estoque?")) {
            return;
        }
        setLoading(true); 
        setError(null);
        try {
            const { error } = await supabase
                .from('stock')
                .delete()
                .eq('id', productId);

            if (error) {
                console.error("Erro ao excluir produto:", error);
                setError(error.message);
            }
        } catch (err: any) {
            console.error("Erro inesperado ao excluir produto:", err);
            setError(err.message || "Erro ao excluir produto.");
        } finally {
            setLoading(false);
        }
    };

    const openUpdateDialog = (item: StockItem) => {
        setSelectedItem(item);
        setUpdateQuantity(item.quantity.toString());
        setIsUpdateDialogOpen(true);
    };

    return (
        <div className="space-y-4">
            {loading && <div className="text-center text-gray-500">Carregando estoque...</div>}
            {error && <div className="text-center text-red-500">Erro: {error}</div>}

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h2 className="text-xl font-semibold">Estoque de Salgadinhos</h2>
                    <Badge variant="outline" className="ml-2">
                        {stock.length} itens
                    </Badge>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Buscar salgadinhos..."
                            className="pl-8 w-[250px]"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="mr-2 h-4 w-4" />
                                Novo Salgadinho
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Adicionar Novo Salgadinho</DialogTitle>
                                <DialogDescription>Preencha os detalhes do novo salgadinho</DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="name">Nome do Salgadinho</Label>
                                    <Input
                                        id="name"
                                        value={newItemName}
                                        onChange={(e) => setNewItemName(e.target.value)}
                                        placeholder="Ex: Coxinha de Frango"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="quantity">Quantidade</Label>
                                        <Input
                                            id="quantity"
                                            type="number"
                                            min="0"
                                            value={newItemQuantity}
                                            onChange={(e) => setNewItemQuantity(e.target.value)}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="unit">Unidade</Label>
                                        <Input
                                            id="unit"
                                            value={newItemUnit}
                                            onChange={(e) => setNewItemUnit(e.target.value)}
                                            placeholder="Ex: un"
                                            disabled 
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="minQuantity">Quantidade Mínima</Label>
                                        <Input
                                            id="minQuantity"
                                            type="number"
                                            min="0"
                                            value={newItemMinQuantity}
                                            onChange={(e) => setNewItemMinQuantity(e.target.value)}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="price">Preço ($)</Label>
                                        <Input
                                            id="price"
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={newItemPrice}
                                            onChange={(e) => setNewItemPrice(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                                    Cancelar
                                </Button>
                                <Button onClick={addNewItem}>Adicionar</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Quantidade</TableHead>
                            <TableHead>Preço</TableHead>
                            <TableHead>Mínimo</TableHead>
                            <TableHead>Status</TableHead>
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
                        ) : filteredStock.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">
                                    Nenhum salgadinho encontrado.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredStock.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell className="font-medium">{item.name}</TableCell>
                                    <TableCell>
                                        {item.quantity} {item.unit}
                                    </TableCell>
                                    <TableCell>$ {item.price.toFixed(2)}</TableCell>
                                    <TableCell>
                                        {item.minQuantity} {item.unit}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={statusColors[item.status]}>
                                            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right flex items-center justify-end gap-2">
                                        <Button variant="outline" size="sm" onClick={() => openUpdateDialog(item)}>
                                            <RefreshCw className="mr-2 h-3 w-3" />
                                            Atualizar
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDeleteProduct(item.id)}
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

            <Dialog open={isUpdateDialogOpen} onOpenChange={setIsUpdateDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Atualizar Quantidade</DialogTitle>
                        <DialogDescription>{selectedItem && `Atualize a quantidade de ${selectedItem.name}`}</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="updateQuantity">Nova Quantidade</Label>
                            <Input
                                id="updateQuantity"
                                type="number"
                                min="0"
                                value={updateQuantity}
                                onChange={(e) => setUpdateQuantity(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsUpdateDialogOpen(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={updateItemQuantity}>Atualizar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
