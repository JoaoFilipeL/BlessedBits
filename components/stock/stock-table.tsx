"use client"
import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Search, Plus, RefreshCw, Trash2, Minus, Eye, Edit } from "lucide-react" 
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
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Textarea } from "../ui/textarea"

interface StockItem {
    id: string
    name: string
    quantity: number
    unit: string
    minQuantity: number
    status: "ok" | "baixo" | "crítico" 
    price: number
    category: string 
}

interface ComboItem {
    product_id: string;
    product_name: string;
    quantity: number;
}

interface ProductCombo {
    id: string;
    name: string;
    description: string | null;
    price: number;
    items: ComboItem[];
}


const statusColors: Record<string, string> = {
    ok: "bg-green-100 text-green-800 hover:bg-green-200",
    baixo: "bg-yellow-100 text-yellow-800 hover:bg-yellow-200",
    crítico: "bg-red-100 text-red-800 hover:bg-red-200",
}

export function StockTable() {
    const [stock, setStock] = useState<StockItem[]>([]) 
    const [combos, setCombos] = useState<ProductCombo[]>([]); 
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
    const [newItemCategory, setNewItemCategory] = useState("salgado");
    const [updateQuantity, setUpdateQuantity] = useState("")
    const [isAddComboDialogOpen, setIsAddComboDialogOpen] = useState(false);
    const [newComboName, setNewComboName] = useState("");
    const [newComboDescription, setNewComboDescription] = useState("");
    const [newComboPrice, setNewComboPrice] = useState("");
    const [newComboItems, setNewComboItems] = useState<ComboItem[]>([]); 
    const [selectedProductForCombo, setSelectedProductForCombo] = useState<string>(""); 
    const [productQuantityForCombo, setProductQuantityForCombo] = useState(1); 
    const [isComboDetailsDialogOpen, setIsComboDetailsDialogOpen] = useState(false); 
    const [selectedComboDetails, setSelectedComboDetails] = useState<ProductCombo | null>(null); 

    const [isEditProductDialogOpen, setIsEditProductDialogOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<StockItem | null>(null);
    const [editProductName, setEditProductName] = useState("");
    const [editProductQuantity, setEditProductQuantity] = useState("");
    const [editProductUnit, setEditProductUnit] = useState("un");
    const [editProductMinQuantity, setEditProductMinQuantity] = useState("");
    const [editProductPrice, setEditProductPrice] = useState("");
    const [editProductCategory, setEditProductCategory] = useState("salgado");
    const [editProductFormError, setEditProductFormError] = useState<string | null>(null);


    const supabase = createClientComponentClient();

    const calculateStatus = useCallback((quantity: number, minQuantity: number): StockItem['status'] => {
        if (quantity <= minQuantity * 0.3) {
            return "crítico";
        } else if (quantity <= minQuantity) {
            return "baixo";
        }
        return "ok";
    }, []);

    const fetchStockAndCombos = useCallback(async () => { 
        setLoading(true);
        setError(null);
        try {
            const { data: stockData, error: stockError } = await supabase
                .from('stock')
                .select('*') 
                .order('name', { ascending: true }); 

            if (stockError) {
                console.error("Erro ao buscar estoque:", stockError);
                setError(stockError.message);
                return;
            }

            const fetchedStock: StockItem[] = stockData.map(item => ({
                id: item.id,
                name: item.name,
                quantity: item.quantity,
                unit: item.unit,
                minQuantity: item.min_quantity, 
                status: calculateStatus(item.quantity, item.min_quantity), 
                price: parseFloat(item.price), 
                category: item.category || 'outros', 
            }));
            setStock(fetchedStock);

            const { data: combosData, error: combosError } = await supabase
                .from('product_combos')
                .select('*')
                .order('name', { ascending: true });

            if (combosError) {
                console.error("Erro ao buscar combos:", combosError);
                setError(combosError.message);
                return;
            }
            setCombos(combosData.map(c => ({
                id: c.id,
                name: c.name,
                description: c.description,
                price: parseFloat(c.price),
                items: typeof c.items === 'string' ? JSON.parse(c.items) : c.items 
            })));


        } catch (err: any) {
            console.error("Erro inesperado ao buscar estoque e combos:", err);
            setError(err.message || "Erro ao carregar estoque e combos.");
        } finally {
            setLoading(false);
        }
    }, [supabase, calculateStatus]);

    useEffect(() => {
        fetchStockAndCombos(); 

        const stockChannel = supabase
            .channel('stock_changes') 
            .on(
                'postgres_changes', 
                { event: '*', schema: 'public', table: 'stock' }, 
                (payload) => {
                    console.log('Mudança recebida em tempo real no estoque!', payload);
                    fetchStockAndCombos();
                }
            )
            .subscribe(); 
        
        const combosChannel = supabase
            .channel('product_combos_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'product_combos' },
                (payload) => {
                    console.log('Mudança recebida em tempo real nos combos!', payload);
                    fetchStockAndCombos();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(stockChannel);
            supabase.removeChannel(combosChannel);
        };
    }, [supabase, fetchStockAndCombos]); 

    const categoryOrder: Record<string, number> = {
        "salgado": 1,
        "doce": 2,
        "bolo": 3,
        "outros": 4,
    };

    const sortedAndFilteredStock = stock
        .filter((item) => item.name.toLowerCase().includes(searchTerm.toLowerCase()))
        .sort((a, b) => {
            const categoryA = categoryOrder[a.category.toLowerCase()] || 99; 
            const categoryB = categoryOrder[b.category.toLowerCase()] || 99;
            if (categoryA !== categoryB) {
                return categoryA - categoryB;
            }
            return a.name.localeCompare(b.name); 
        });

    const filteredCombos = combos.filter((combo) =>
        combo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (combo.description && combo.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const addNewItem = async () => {
        const quantity = Number.parseFloat(newItemQuantity);
        const minQuantity = Number.parseFloat(newItemMinQuantity);
        const price = Number.parseFloat(newItemPrice);

        if (!newItemName || isNaN(quantity) || isNaN(minQuantity) || isNaN(price) || quantity < 0 || minQuantity < 0 || price < 0 || !newItemCategory) {
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
                        category: newItemCategory,
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
            setNewItemCategory("salgado"); 
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
        if (!confirm("Tem certeza que deseja excluir este produto do estoque? Se este produto estiver em algum pedido, a exclusão falhará devido a restrições de integridade do banco de dados.")) {
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
                if (error.code === '23503') { 
                    setError("Não foi possível excluir o produto. Ele está associado a um ou mais pedidos. Por favor, remova-o dos pedidos primeiro ou ajuste as configurações do banco de dados.");
                } else {
                    setError(error.message);
                }
            } else {
                setError(null); 
            }
        } catch (err: any) {
            console.error("Erro inesperado ao excluir produto:", err);
            setError(err.message || "Erro ao excluir produto.");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteCombo = async (comboId: string) => {
        if (!confirm("Tem certeza que deseja excluir este combo?")) {
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const { error } = await supabase
                .from('product_combos')
                .delete()
                .eq('id', comboId);

            if (error) {
                console.error("Erro ao excluir combo:", error);
                setError(error.message);
            } else {
                setError(null);
            }
        } catch (err: any) {
            console.error("Erro inesperado ao excluir combo:", err);
            setError(err.message || "Erro ao excluir combo.");
        } finally {
            setLoading(false);
        }
    };

    const openUpdateDialog = (item: StockItem) => {
        setSelectedItem(item);
        setUpdateQuantity(item.quantity.toString());
        setIsUpdateDialogOpen(true);
    };

    const openEditProductDialog = (product: StockItem) => {
        setEditingProduct(product);
        setEditProductName(product.name);
        setEditProductQuantity(product.quantity.toString());
        setEditProductUnit(product.unit);
        setEditProductMinQuantity(product.minQuantity.toString());
        setEditProductPrice(product.price.toFixed(2));
        setEditProductCategory(product.category);
        setEditProductFormError(null);
        setIsEditProductDialogOpen(true);
    };

    const updateProduct = async () => {
        if (!editingProduct) return;

        const quantity = Number.parseFloat(editProductQuantity);
        const minQuantity = Number.parseFloat(editProductMinQuantity);
        const price = Number.parseFloat(editProductPrice);

        if (!editProductName || isNaN(quantity) || isNaN(minQuantity) || isNaN(price) || quantity < 0 || minQuantity < 0 || price < 0 || !editProductCategory) {
            setEditProductFormError("Por favor, preencha todos os campos corretamente e com valores válidos.");
            return;
        }

        try {
            const { error } = await supabase
                .from('stock')
                .update({
                    name: editProductName,
                    quantity: quantity,
                    unit: editProductUnit,
                    min_quantity: minQuantity,
                    price: price,
                    category: editProductCategory,
                })
                .eq('id', editingProduct.id);

            if (error) {
                console.error("Erro ao atualizar produto:", error);
                setEditProductFormError(error.message);
                return;
            }

            setIsEditProductDialogOpen(false);
            setEditingProduct(null);
            setEditProductFormError(null);
        } catch (err: any) {
            console.error("Erro inesperado ao atualizar produto:", err);
            setEditProductFormError(err.message || "Erro ao atualizar produto.");
        }
    };


    const addProductToCombo = () => {
        if (!selectedProductForCombo || productQuantityForCombo <= 0) {
            setError("Selecione um produto e uma quantidade válida para o combo.");
            return;
        }
        const product = stock.find(p => p.id === selectedProductForCombo);
        if (!product) {
            setError("Produto selecionado para combo não encontrado.");
            return;
        }

        const existingItemIndex = newComboItems.findIndex(item => item.product_id === selectedProductForCombo);
        if (existingItemIndex >= 0) {
            const updatedItems = [...newComboItems];
            updatedItems[existingItemIndex].quantity += productQuantityForCombo;
            setNewComboItems(updatedItems);
        } else {
            setNewComboItems([...newComboItems, { product_id: product.id, product_name: product.name, quantity: productQuantityForCombo }]);
        }
        setSelectedProductForCombo("");
        setProductQuantityForCombo(1);
        setError(null);
    };

    const removeProductFromCombo = (index: number) => {
        setNewComboItems(newComboItems.filter((_, i) => i !== index));
    };

    const addNewCombo = async () => {
        const comboPrice = Number.parseFloat(newComboPrice);
        if (!newComboName || isNaN(comboPrice) || comboPrice <= 0 || newComboItems.length === 0) {
            setError("Por favor, preencha o nome, preço e adicione pelo menos um item ao combo.");
            return;
        }

        try {
            const { error } = await supabase
                .from('product_combos')
                .insert([
                    {
                        name: newComboName,
                        description: newComboDescription || null,
                        price: comboPrice,
                        items: newComboItems, 
                    },
                ]);

            if (error) {
                console.error("Erro ao adicionar novo combo:", error);
                setError(error.message);
                return;
            }

            setNewComboName("");
            setNewComboDescription("");
            setNewComboPrice("");
            setNewComboItems([]);
            setIsAddComboDialogOpen(false);
            setError(null);
        } catch (err: any) {
            console.error("Erro inesperado ao adicionar combo:", err);
            setError(err.message || "Erro ao adicionar combo.");
        }
    };

    const openComboDetailsDialog = (combo: ProductCombo) => {
        setSelectedComboDetails(combo);
        setIsComboDetailsDialogOpen(true);
    };


    return (
        <div className="space-y-4 p-4 md:p-6 lg:p-8">
            {loading && <div className="text-center text-gray-500">Carregando estoque e combos...</div>}
            {error && <div className="text-center text-red-500">Erro: {error}</div>}

            <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-semibold">Estoque de Produtos</h2>
                    <Badge variant="outline" className="ml-2">
                        {stock.length} itens
                    </Badge>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
                    <div className="relative w-full sm:w-auto">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Buscar produtos..."
                            className="pl-8 w-full sm:w-[250px]"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="w-full sm:w-auto">
                                <Plus className="mr-2 h-4 w-4" />
                                Novo Produto
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md w-[90%]">
                            <DialogHeader>
                                <DialogTitle>Adicionar Novo Produto</DialogTitle>
                                <DialogDescription>Preencha os detalhes do novo produto.</DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4 overflow-y-auto max-h-[70vh] pr-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="name">Nome do Produto</Label>
                                    <Input
                                        id="name"
                                        value={newItemName}
                                        onChange={(e) => setNewItemName(e.target.value)}
                                        placeholder="Ex: Coxinha de Frango"
                                    />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                                <div className="grid gap-2">
                                    <Label htmlFor="category">Categoria</Label>
                                    <Select value={newItemCategory} onValueChange={setNewItemCategory}>
                                        <SelectTrigger id="category">
                                            <SelectValue placeholder="Selecione uma categoria" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="salgado">Salgado</SelectItem>
                                            <SelectItem value="doce">Doce</SelectItem>
                                            <SelectItem value="bolo">Bolo</SelectItem>
                                            <SelectItem value="outros">Outros</SelectItem>
                                        </SelectContent>
                                    </Select>
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
                    <Dialog open={isAddComboDialogOpen} onOpenChange={setIsAddComboDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="w-full sm:w-auto">
                                <Plus className="mr-2 h-4 w-4" />
                                Novo Combo
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-xl w-[90%]">
                            <DialogHeader>
                                <DialogTitle>Adicionar Novo Combo</DialogTitle>
                                <DialogDescription>Defina os produtos que compõem este combo.</DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4 overflow-y-auto max-h-[70vh] pr-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="comboName">Nome do Combo</Label>
                                    <Input
                                        id="comboName"
                                        value={newComboName}
                                        onChange={(e) => setNewComboName(e.target.value)}
                                        placeholder="Ex: Combo Família"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="comboDescription">Descrição (opcional)</Label>
                                    <Textarea
                                        id="comboDescription"
                                        value={newComboDescription}
                                        onChange={(e) => setNewComboDescription(e.target.value)}
                                        placeholder="Ex: 25 coxinhas, 25 bolinhas + 1 refri"
                                        rows={2}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="comboPrice">Preço do Combo ($)</Label>
                                    <Input
                                        id="comboPrice"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={newComboPrice}
                                        onChange={(e) => setNewComboPrice(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Adicionar Produtos ao Combo</Label>
                                    <div className="flex flex-col sm:flex-row items-center gap-2">
                                        <Select value={selectedProductForCombo} onValueChange={setSelectedProductForCombo}>
                                            <SelectTrigger className="flex-1 min-w-[180px]">
                                                <SelectValue placeholder="Selecione um produto" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {stock.map((product) => ( 
                                                    <SelectItem key={product.id} value={product.id}>
                                                        {product.name} ({product.quantity} {product.unit})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Input
                                            type="number"
                                            min="1"
                                            value={productQuantityForCombo}
                                            onChange={(e) => setProductQuantityForCombo(parseInt(e.target.value) || 1)}
                                            className="w-20 text-center flex-shrink-0"
                                        />
                                        <Button type="button" onClick={addProductToCombo} disabled={!selectedProductForCombo || productQuantityForCombo <= 0} className="flex-shrink-0">
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                                {newComboItems.length > 0 && (
                                    <div className="space-y-2 border rounded-md p-4">
                                        <Label>Itens no Combo:</Label>
                                        {newComboItems.map((item, index) => (
                                            <div key={index} className="flex justify-between items-center border-b pb-2">
                                                <div>{item.quantity}x {item.product_name}</div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0 text-red-500"
                                                    onClick={() => removeProductFromCombo(index)}
                                                >
                                                    <Minus className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsAddComboDialogOpen(false)}>
                                    Cancelar
                                </Button>
                                <Button onClick={addNewCombo}>Criar Combo</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>
            <div className="rounded-md border overflow-x-auto mb-8">
                <Table className="min-w-full">
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead className="min-w-[80px]">Quantidade</TableHead>
                            <TableHead className="min-w-[80px]">Preço</TableHead>
                            <TableHead className="hidden md:table-cell">Mínimo</TableHead>
                            <TableHead className="min-w-[80px]">Status</TableHead>
                            <TableHead className="min-w-[100px]">Categoria</TableHead> 
                            <TableHead className="text-right min-w-[120px]">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center"> 
                                    Carregando dados do estoque...
                                </TableCell>
                            </TableRow>
                        ) : error && !error.includes("Não foi possível excluir") ? ( 
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center text-red-500"> 
                                    {error}
                                </TableCell>
                            </TableRow>
                        ) : sortedAndFilteredStock.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center"> 
                                    Nenhum produto encontrado.
                                </TableCell>
                            </TableRow>
                        ) : (
                            sortedAndFilteredStock.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell className="font-medium">{item.name}</TableCell>
                                    <TableCell>
                                        {item.quantity} {item.unit}
                                    </TableCell>
                                    <TableCell>$ {item.price.toFixed(2)}</TableCell>
                                    <TableCell className="hidden md:table-cell">
                                        {item.minQuantity} {item.unit}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={statusColors[item.status]}>
                                            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{item.category.charAt(0).toUpperCase() + item.category.slice(1)}</TableCell>
                                    <TableCell className="text-right flex items-center justify-end gap-2">
                                        <Button variant="outline" size="sm" onClick={() => openUpdateDialog(item)}>
                                            <RefreshCw className="mr-2 h-3 w-3" />
                                            Atualizar
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => openEditProductDialog(item)} 
                                        >
                                            <Edit className="mr-2 h-3 w-3" />
                                            Editar
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
                {error && error.includes("Não foi possível excluir") && ( 
                    <div className="text-center text-red-500 mt-4 p-2 border border-red-500 rounded-md">
                        {error}
                    </div>
                )}
            </div>
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-semibold">Combos Disponíveis</h2>
                    <Badge variant="outline" className="ml-2">
                        {combos.length} combos
                    </Badge>
                </div>
            </div>
            <div className="rounded-md border overflow-x-auto">
                <Table className="min-w-full">
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nome do Combo</TableHead>
                            <TableHead>Descrição</TableHead>
                            <TableHead className="min-w-[80px]">Preço</TableHead>
                            <TableHead className="text-right min-w-[120px]">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center">
                                    Carregando combos...
                                </TableCell>
                            </TableRow>
                        ) : filteredCombos.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center">
                                    Nenhum combo encontrado.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredCombos.map((combo) => (
                                <TableRow key={combo.id}>
                                    <TableCell className="font-medium">{combo.name}</TableCell>
                                    <TableCell className="max-w-[250px] truncate" title={combo.description || "Sem descrição"}>
                                        {combo.description || "Sem descrição"}
                                    </TableCell>
                                    <TableCell>$ {combo.price.toFixed(2)}</TableCell>
                                    <TableCell className="text-right flex items-center justify-end gap-2">
                                        <Button variant="outline" size="sm" onClick={() => openComboDetailsDialog(combo)}>
                                            <Eye className="mr-2 h-3 w-3" />
                                            Detalhes
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDeleteCombo(combo.id)}
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
            <Dialog open={isComboDetailsDialogOpen} onOpenChange={setIsComboDetailsDialogOpen}>
                <DialogContent className="max-w-md w-[90%]">
                    <DialogHeader>
                        <DialogTitle>Detalhes do Combo: {selectedComboDetails?.name}</DialogTitle>
                        <DialogDescription>{selectedComboDetails?.description || "Nenhuma descrição."}</DialogDescription>
                    </DialogHeader>
                    {selectedComboDetails && (
                        <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Preço:</Label>
                                <p className="text-base">$ {selectedComboDetails.price.toFixed(2)}</p>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Itens do Combo:</Label>
                                <ul className="list-disc pl-5">
                                    {selectedComboDetails.items.map((item, index) => (
                                        <li key={index} className="text-base">
                                            {item.quantity}x {item.product_name}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button onClick={() => setIsComboDetailsDialogOpen(false)}>Fechar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isUpdateDialogOpen} onOpenChange={setIsUpdateDialogOpen}>
                <DialogContent className="max-w-md w-[90%]">
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

            <Dialog open={isEditProductDialogOpen} onOpenChange={setIsEditProductDialogOpen}>
                <DialogContent className="max-w-md w-[90%]">
                    <DialogHeader>
                        <DialogTitle>Editar Produto: {editingProduct?.name}</DialogTitle>
                        <DialogDescription>Edite os detalhes do produto.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4 overflow-y-auto max-h-[70vh] pr-4">
                        {editProductFormError && (
                            <div className="bg-red-100 text-red-700 p-3 rounded-md text-sm">
                                {editProductFormError}
                            </div>
                        )}
                        <div className="grid gap-2">
                            <Label htmlFor="editProductName">Nome do Produto</Label>
                            <Input
                                id="editProductName"
                                value={editProductName}
                                onChange={(e) => setEditProductName(e.target.value)}
                                placeholder="Ex: Coxinha de Frango"
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="editProductQuantity">Quantidade</Label>
                                <Input
                                    id="editProductQuantity"
                                    type="number"
                                    min="0"
                                    value={editProductQuantity}
                                    onChange={(e) => setEditProductQuantity(e.target.value)}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="editProductUnit">Unidade</Label>
                                <Input
                                    id="editProductUnit"
                                    value={editProductUnit}
                                    onChange={(e) => setEditProductUnit(e.target.value)}
                                    placeholder="Ex: un"
                                    disabled
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="editProductMinQuantity">Quantidade Mínima</Label>
                                <Input
                                    id="editProductMinQuantity"
                                    type="number"
                                    min="0"
                                    value={editProductMinQuantity}
                                    onChange={(e) => setEditProductMinQuantity(e.target.value)}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="editProductPrice">Preço ($)</Label>
                                <Input
                                    id="editProductPrice"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={editProductPrice}
                                    onChange={(e) => setEditProductPrice(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="editProductCategory">Categoria</Label>
                            <Select value={editProductCategory} onValueChange={setEditProductCategory}>
                                <SelectTrigger id="editProductCategory">
                                    <SelectValue placeholder="Selecione uma categoria" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="salgado">Salgado</SelectItem>
                                    <SelectItem value="doce">Doce</SelectItem>
                                    <SelectItem value="bolo">Bolo</SelectItem>
                                    <SelectItem value="outros">Outros</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditProductDialogOpen(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={updateProduct}>
                            Salvar Alterações
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
