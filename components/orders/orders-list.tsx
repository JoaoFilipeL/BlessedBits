"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Search, Plus, Minus, RefreshCw, Eye, Trash2 } from "lucide-react"
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
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

type OrderStatus = "em análise" | "em produção" | "pronto" | "cancelado"

const statusColors: Record<OrderStatus, string> = {
    "em análise": "bg-yellow-100 text-yellow-800 hover:bg-yellow-200",
    "em produção": "bg-blue-100 text-blue-800 hover:bg-blue-200",
    pronto: "bg-green-100 text-green-800 hover:bg-green-200",
    cancelado: "bg-red-100 text-red-800 hover:bg-red-200",
}

interface Product {
    id: string;
    name: string;
    price: number;
    quantity?: number;
}

interface OrderItem {
    product_id: string;
    product_name: string;
    product_price: number;
    quantity: number;
}

interface Order {
    id: number;
    customer_name: string;
    customer_phone: string;
    address: string | null;
    notes: string | null;
    total_amount: number;
    status: OrderStatus;
    created_at: string;
    items: OrderItem[];
}

export function OrdersList() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState<OrderStatus | "todos">("todos");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [customerName, setCustomerName] = useState("");
    const [customerPhone, setCustomerPhone] = useState("");
    const [address, setAddress] = useState("");
    const [notes, setNotes] = useState("");
    const [items, setItems] = useState<OrderItem[]>([]);
    const [selectedProductId, setSelectedProductId] = useState<string>("");
    const [itemQuantity, setItemQuantity] = useState(1);

    const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
    const [selectedOrderDetails, setSelectedOrderDetails] = useState<Order | null>(null);


    const supabase = createClientComponentClient();

    const fetchProducts = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('stock')
                .select('id, name, price, quantity')
                .order('name', { ascending: true });

            if (error) {
                console.error("Erro ao buscar produtos:", error);
                return;
            }
            setProducts(data.map(p => ({ id: p.id, name: p.name, price: parseFloat(p.price), quantity: p.quantity })));
        } catch (err: any) {
            console.error("Erro inesperado ao buscar produtos:", err);
            setError(err.message || "Erro ao carregar produtos.");
        }
    }, [supabase]);

    const fetchOrders = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { data: ordersData, error: ordersError } = await supabase
                .from('orders')
                .select('*')
                .order('created_at', { ascending: false });

            if (ordersError) {
                console.error("Erro ao buscar pedidos:", ordersError);
                setError(ordersError.message);
                setLoading(false);
                return;
            }

            const orderIds = ordersData.map(order => order.id);
            const { data: orderItemsData, error: orderItemsError } = await supabase
                .from('order_items')
                .select('*')
                .in('order_id', orderIds);

            if (orderItemsError) {
                console.error("Erro ao buscar itens de pedido:", orderItemsError);
                setError(orderItemsError.message);
                setLoading(false);
                return;
            }

            const combinedOrders: Order[] = ordersData.map(order => {
                const itemsForOrder: OrderItem[] = orderItemsData
                    .filter(item => item.order_id === order.id)
                    .map(item => ({
                        product_id: item.product_id,
                        product_name: item.product_name,
                        product_price: parseFloat(item.product_price),
                        quantity: item.quantity,
                    }));

                return {
                    id: order.id,
                    customer_name: order.customer_name,
                    customer_phone: order.customer_phone,
                    address: order.address,
                    notes: order.notes,
                    total_amount: parseFloat(order.total_amount),
                    status: order.status as OrderStatus,
                    created_at: order.created_at,
                    items: itemsForOrder,
                };
            });
            setOrders(combinedOrders);
        } catch (err: any) {
            console.error("Erro inesperado ao buscar pedidos:", err);
            setError(err.message || "Erro ao carregar pedidos.");
        } finally {
            setLoading(false);
        }
    }, [supabase]);

    useEffect(() => {
        fetchProducts();
        fetchOrders();

        const ordersChannel = supabase
            .channel('orders_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'orders' },
                (payload) => {
                    console.log('Mudança em pedidos em tempo real!', payload);
                    fetchOrders();
                }
            )
            .subscribe();

        const orderItemsChannel = supabase
            .channel('order_items_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'order_items' },
                (payload) => {
                    console.log('Mudança em itens de pedido em tempo real!', payload);
                    fetchOrders();
                }
            )
            .subscribe();

        const stockChannel = supabase
            .channel('orders_stock_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'stock' },
                (payload) => {
                    console.log('Mudança no estoque em tempo real para pedidos!', payload);
                    fetchProducts();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(ordersChannel);
            supabase.removeChannel(orderItemsChannel);
            supabase.removeChannel(stockChannel);
        };
    }, [supabase, fetchProducts, fetchOrders]);

    const filteredOrders = orders.filter(
        (order) =>
            (order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                order.id.toString().includes(searchTerm) ||
                order.customer_phone.toLowerCase().includes(searchTerm.toLowerCase())) &&
            (selectedStatus === "todos" || order.status === selectedStatus),
    );

    const handleItemQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(e.target.value);
        if (!isNaN(value) && value >= 1) {
            setItemQuantity(value);
        } else if (e.target.value === "") {
            setItemQuantity(1);
        }
    };

    const incrementQuantity = () => {
        setItemQuantity((prev) => prev + 1);
    };

    const decrementQuantity = () => {
        setItemQuantity((prev) => (prev > 1 ? prev - 1 : 1));
    };

    const addItem = () => {
        if (!selectedProductId) return;

        const product = products.find((p) => p.id === selectedProductId);
        if (!product) return;

        if (product.quantity !== undefined && itemQuantity > product.quantity) {
            setError(`Estoque insuficiente para ${product.name}. Disponível: ${product.quantity}`);
            return;
        }

        const existingItemIndex = items.findIndex((item) => item.product_id === product.id);

        if (existingItemIndex >= 0) {
            const updatedItems = [...items];
            const newTotalQuantity = updatedItems[existingItemIndex].quantity + itemQuantity;
            if (product.quantity !== undefined && newTotalQuantity > product.quantity) {
                setError(`Estoque insuficiente para ${product.name}. Você já tem ${updatedItems[existingItemIndex].quantity} e quer adicionar ${itemQuantity}. Disponível total: ${product.quantity}`);
                return;
            }
            updatedItems[existingItemIndex].quantity = newTotalQuantity;
            setItems(updatedItems);
        } else {
            setItems([
                ...items,
                {
                    product_id: product.id,
                    product_name: product.name,
                    product_price: product.price,
                    quantity: itemQuantity,
                },
            ]);
        }

        setSelectedProductId("");
        setItemQuantity(1);
        setError(null);
    };

    const removeItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const calculateTotal = () => {
        return items.reduce((sum, item) => sum + item.product_price * item.quantity, 0);
    };

    const formatPhoneNumber = (value: string) => {
        const numericValue = value.replace(/\D/g, "");
        if (numericValue.length <= 2) {
            return numericValue;
        } else if (numericValue.length <= 7) {
            return `(${numericValue.slice(0, 2)}) ${numericValue.slice(2)}`;
        } else {
            return `(${numericValue.slice(0, 2)}) ${numericValue.slice(2, 7)}-${numericValue.slice(7, 11)}`;
        }
    };

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setCustomerPhone(formatPhoneNumber(e.target.value));
    };

    const formatItemsForDisplay = (orderItems: OrderItem[]) => {
        return orderItems.map((item) => `${item.quantity}x ${item.product_name}`).join(", ");
    };

    const formatOrderId = (id: number) => {
        return `PED-${id.toString().padStart(4, '0')}`;
    };

    const addNewOrder = async () => {
        if (items.length === 0 || !customerName || !customerPhone) {
            console.error("Por favor, preencha o nome do cliente, telefone e adicione pelo menos um item ao pedido.");
            setError("Por favor, preencha o nome do cliente, telefone e adicione pelo menos um item ao pedido.");
            return;
        }

        try {
            const { data: currentStock, error: stockFetchError } = await supabase
                .from('stock')
                .select('id, quantity')
                .in('id', items.map(item => item.product_id));

            if (stockFetchError) throw stockFetchError;

            for (const orderItem of items) {
                const stockProduct = currentStock.find(s => s.id === orderItem.product_id);
                if (!stockProduct || stockProduct.quantity < orderItem.quantity) {
                    setError(`Estoque insuficiente para ${orderItem.product_name}. Disponível: ${stockProduct?.quantity || 0}`);
                    return;
                }
            }

            const { data: orderData, error: orderError } = await supabase
                .from('orders')
                .insert({
                    customer_name: customerName,
                    customer_phone: customerPhone,
                    address: address || null,
                    notes: notes || null,
                    total_amount: calculateTotal(),
                    status: "em análise",
                })
                .select()
                .single();

            if (orderError) throw orderError;

            const orderItemsToInsert = items.map(item => ({
                order_id: orderData.id,
                product_id: item.product_id,
                product_name: item.product_name,
                product_price: item.product_price,
                quantity: item.quantity,
            }));

            const { error: orderItemsError } = await supabase
                .from('order_items')
                .insert(orderItemsToInsert);

            if (orderItemsError) throw orderItemsError;

            const updatePromises = items.map(async (orderItem) => {
                const productInCurrentStock = currentStock.find(s => s.id === orderItem.product_id);
                const newQuantity = (productInCurrentStock?.quantity || 0) - orderItem.quantity;

                const { error: updateError } = await supabase
                    .from('stock')
                    .update({ quantity: newQuantity })
                    .eq('id', orderItem.product_id);

                if (updateError) {
                    console.error(`Erro ao deduzir estoque para ${orderItem.product_name}:`, updateError);
                    throw new Error(`Falha ao deduzir estoque para ${orderItem.product_name}`);
                }
            });
            await Promise.all(updatePromises);

            setCustomerName("");
            setCustomerPhone("");
            setAddress("");
            setNotes("");
            setItems([]);
            setSelectedProductId("");
            setItemQuantity(1);
            setIsAddDialogOpen(false);
            setError(null);
        } catch (err: any) {
            console.error("Erro ao registrar pedido ou deduzir estoque:", err);
            setError(err.message || "Erro ao registrar pedido ou deduzir estoque.");
        }
    };

    const updateOrderStatus = async (orderId: number, newStatus: OrderStatus) => {
        try {
            const { data: orderDetails, error: fetchOrderDetailsError } = await supabase
                .from('orders')
                .select('total_amount, status, items:order_items(product_id, quantity)')
                .eq('id', orderId)
                .single();

            if (fetchOrderDetailsError) throw fetchOrderDetailsError;

            const oldStatus = orderDetails.status;
            const orderTotalAmount = orderDetails.total_amount;
            const orderItems = orderDetails.items;

            if (newStatus === "pronto" && oldStatus !== "pronto") {
                const { data: existingSale, error: checkSaleError } = await supabase
                    .from('financial_transactions')
                    .select('id')
                    .eq('order_id', orderId)
                    .eq('type', 'receita')
                    .single();

                if (checkSaleError && checkSaleError.code !== 'PGRST116') {
                    console.error("Erro ao verificar transação de venda existente:", checkSaleError);
                }

                if (!existingSale) {
                    const { error: insertFinancialError } = await supabase
                        .from('financial_transactions')
                        .insert({
                            transaction_date: new Date().toISOString().split('T')[0],
                            description: `Venda do Pedido ${formatOrderId(orderId)}`,
                            category: 'venda',
                            amount: orderTotalAmount,
                            type: 'receita',
                            order_id: orderId,
                        });

                    if (insertFinancialError) {
                        console.error("Erro ao registrar transação de venda:", insertFinancialError);
                    }
                }
            } else if (newStatus === "cancelado" && oldStatus !== "cancelado") {
                const revertStockPromises = orderItems.map(async (item: any) => {
                    const { data: currentStockItem, error: stockError } = await supabase
                        .from('stock')
                        .select('quantity')
                        .eq('id', item.product_id)
                        .single();

                    if (stockError) throw stockError;

                    const newQuantity = (currentStockItem?.quantity || 0) + item.quantity;

                    const { error: updateStockError } = await supabase
                        .from('stock')
                        .update({ quantity: newQuantity })
                        .eq('id', item.product_id);

                    if (updateStockError) throw updateStockError;
                });
                await Promise.all(revertStockPromises);

                const { error: insertCancelTransactionError } = await supabase
                    .from('financial_transactions')
                    .insert({
                        transaction_date: new Date().toISOString().split('T')[0],
                        description: `Cancelamento do Pedido ${formatOrderId(orderId)}`,
                        category: 'venda',
                        amount: -orderTotalAmount,
                        type: 'receita',
                        order_id: orderId,
                    });

                if (insertCancelTransactionError) {
                    console.error("Erro ao registrar transação de cancelamento:", insertCancelTransactionError);
                }
            }

            const { error } = await supabase
                .from('orders')
                .update({ status: newStatus })
                .eq('id', orderId);

            if (error) {
                console.error("Erro ao atualizar status do pedido:", error);
                setError(error.message);
                return;
            }
            setError(null);
        } catch (err: any) {
            console.error("Erro inesperado ao atualizar status:", err);
            setError(err.message || "Erro ao atualizar status.");
        }
    };

    const handleDeleteOrder = async (orderId: number) => {
        if (!confirm("Tem certeza que deseja excluir este pedido? Esta ação é irreversível e não reverte o estoque nem o faturamento.")) {
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const { error: deleteFinancialError } = await supabase
                .from('financial_transactions')
                .delete()
                .eq('order_id', orderId);

            if (deleteFinancialError) {
                console.error("Erro ao remover transações financeiras ao excluir pedido:", deleteFinancialError);
            }

            const { error } = await supabase
                .from('orders')
                .delete()
                .eq('id', orderId);

            if (error) {
                console.error("Erro ao excluir pedido:", error);
                setError(error.message);
            }
        } catch (err: any) {
            console.error("Erro inesperado ao excluir pedido:", err);
            setError(err.message || "Erro ao excluir pedido.");
        } finally {
            setLoading(false);
        }
    };

    const openOrderDetailsDialog = (order: Order) => {
        setSelectedOrderDetails(order);
        setIsDetailsDialogOpen(true);
    };

    const formatOrderDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <div className="space-y-4 p-4 md:p-6 lg:p-8">
            {loading && <div className="text-center text-gray-500">Carregando pedidos...</div>}
            {error && <div className="text-center text-red-500">Erro: {error}</div>}

            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-semibold">Todos os Pedidos</h2>
                    <Badge variant="outline" className="ml-2">
                        {orders.length} total
                    </Badge>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
                    <div className="relative w-full sm:w-auto">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Buscar pedidos..."
                            className="pl-8 w-full sm:w-[250px]"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Select value={selectedStatus} onValueChange={(value: any) => setSelectedStatus(value)}>
                        <SelectTrigger className="w-full sm:w-[180px]">
                            <SelectValue placeholder="Filtrar por status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todos">Todos os status</SelectItem>
                            <SelectItem value="em análise">Em análise</SelectItem>
                            <SelectItem value="em produção">Em produção</SelectItem>
                            <SelectItem value="pronto">Pronto</SelectItem>
                            <SelectItem value="cancelado">Cancelado</SelectItem>
                        </SelectContent>
                    </Select>
                    <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="w-full sm:w-auto">
                                <Plus className="mr-2 h-4 w-4" />
                                Novo Pedido
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl w-[90%]">
                            <DialogHeader>
                                <DialogTitle>Novo Pedido</DialogTitle>
                                <DialogDescription>Registre um novo pedido no sistema</DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-6 py-4 overflow-y-auto max-h-[70vh] pr-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="name">Nome do Cliente</Label>
                                        <Input
                                            id="name"
                                            placeholder="Nome completo"
                                            value={customerName}
                                            onChange={(e) => setCustomerName(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="phone">Telefone</Label>
                                        <Input
                                            id="phone"
                                            placeholder="(00) 00000-0000"
                                            value={customerPhone}
                                            onChange={handlePhoneChange}
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="address">Endereço de Entrega (opcional)</Label>
                                    <Textarea
                                        id="address"
                                        placeholder="Endereço completo"
                                        value={address}
                                        onChange={(e) => setAddress(e.target.value)}
                                        rows={2}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Itens do Pedido</Label>
                                    <div className="flex flex-wrap items-center gap-2 w-full">
                                        <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                                            <SelectTrigger className="flex-1 min-w-[180px]">
                                                <SelectValue placeholder="Selecione um produto" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {products.map((product) => (
                                                    <SelectItem key={product.id} value={product.id} disabled={(product.quantity || 0) <= 0}>
                                                        {product.name} - $ {product.price.toFixed(2)} ({product.quantity !== undefined ? `${product.quantity} no estoque` : '...'})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <div className="flex items-center flex-shrink-0">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="icon"
                                                onClick={decrementQuantity}
                                                disabled={itemQuantity <= 1}
                                                className="h-10 w-10 rounded-r-none"
                                            >
                                                <Minus className="h-4 w-4" />
                                            </Button>
                                            <Input
                                                type="number"
                                                min="1"
                                                value={itemQuantity}
                                                onChange={handleItemQuantityChange}
                                                className="w-16 text-center h-10 rounded-none border border-l-0 border-r-0"
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="icon"
                                                onClick={incrementQuantity}
                                                className="h-10 w-10 rounded-l-none"
                                            >
                                                <Plus className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        <Button type="button" onClick={addItem} disabled={!selectedProductId || itemQuantity <= 0} className="w-full sm:w-auto">
                                            Adicionar
                                        </Button>
                                    </div>
                                </div>
                                {items.length > 0 && (
                                    <div className="space-y-2 border rounded-md p-4">
                                        <Label>Itens Adicionados</Label>
                                        <div className="space-y-2">
                                            {items.map((item, index) => (
                                                <div key={index} className="flex justify-between items-center border-b pb-2">
                                                    <div>
                                                        <span className="font-medium">{item.quantity}x </span>
                                                        {item.product_name}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="text-sm">$ {(item.product_price * item.quantity).toFixed(2)}</div>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 w-8 p-0 text-red-500"
                                                            onClick={() => removeItem(index)}
                                                        >
                                                            ✕
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                            <div className="flex justify-between items-center pt-2 font-bold">
                                                <div>Total</div>
                                                <div>$ {calculateTotal().toFixed(2)}</div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div className="space-y-2">
                                    <Label htmlFor="notes">Observações (opcional)</Label>
                                    <Textarea
                                        id="notes"
                                        placeholder="Observações sobre o pedido"
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        rows={2}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                                    Cancelar
                                </Button>
                                <Button onClick={addNewOrder} disabled={items.length === 0 || !customerName || !customerPhone}>
                                    Registrar Pedido
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
                            <TableHead className="w-[100px]">Pedido</TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Telefone</TableHead>
                            <TableHead>Itens</TableHead>
                            <TableHead>Total</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center">
                                    Carregando pedidos...
                                </TableCell>
                            </TableRow>
                        ) : error ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center text-red-500">
                                    {error}
                                </TableCell>
                            </TableRow>
                        ) : filteredOrders.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center">
                                    Nenhum pedido encontrado.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredOrders.map((order) => (
                                <TableRow key={order.id}>
                                    <TableCell className="font-medium">{formatOrderId(order.id)}</TableCell>
                                    <TableCell>{order.customer_name}</TableCell>
                                    <TableCell>{order.customer_phone}</TableCell>
                                    <TableCell className="max-w-[200px] truncate" title={formatItemsForDisplay(order.items)}>
                                        {formatItemsForDisplay(order.items)}
                                    </TableCell>
                                    <TableCell>$ {order.total_amount.toFixed(2)}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={statusColors[order.status]}>
                                            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right flex items-center justify-end gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => openOrderDetailsDialog(order)}
                                        >
                                            <Eye className="h-3 w-3 mr-1" /> Detalhes
                                        </Button>
                                        <Select
                                            value={order.status}
                                            onValueChange={(value: OrderStatus) => updateOrderStatus(order.id, value)}
                                            disabled={order.status === "cancelado" || loading}
                                        >
                                            <SelectTrigger className="w-[140px]">
                                                <SelectValue placeholder="Alterar status" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="em análise">Em análise</SelectItem>
                                                <SelectItem value="em produção">Em produção</SelectItem>
                                                <SelectItem value="pronto">Pronto</SelectItem>
                                                <SelectItem value="cancelado">Cancelado</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDeleteOrder(order.id)}
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

            <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
                <DialogContent className="max-w-xl w-[90%]">
                    <DialogHeader>
                        <DialogTitle>Detalhes do Pedido: {selectedOrderDetails ? formatOrderId(selectedOrderDetails.id) : ''}</DialogTitle>
                        <DialogDescription>Informações completas sobre o pedido.</DialogDescription>
                    </DialogHeader>
                    {selectedOrderDetails && (
                        <div className="grid gap-4 py-4 overflow-y-auto max-h-[70vh] pr-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium">Cliente:</Label>
                                    <p className="text-base">{selectedOrderDetails.customer_name}</p>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium">Telefone:</Label>
                                    <p className="text-base">{selectedOrderDetails.customer_phone}</p>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Endereço de Entrega:</Label>
                                <p className="text-base">{selectedOrderDetails.address || 'Não informado'}</p>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Itens do Pedido:</Label>
                                <ul className="list-disc pl-5">
                                    {selectedOrderDetails.items.map((item, index) => (
                                        <li key={index} className="text-base">
                                            {item.quantity}x {item.product_name} - $ {(item.product_price * item.quantity).toFixed(2)}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Total do Pedido:</Label>
                                <p className="text-lg font-bold">$ {selectedOrderDetails.total_amount.toFixed(2)}</p>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Status:</Label>
                                <Badge variant="outline" className={statusColors[selectedOrderDetails.status]}>
                                    {selectedOrderDetails.status.charAt(0).toUpperCase() + selectedOrderDetails.status.slice(1)}
                                </Badge>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Data do Pedido:</Label>
                                <p className="text-base">{formatOrderDate(selectedOrderDetails.created_at)}</p>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Observações:</Label>
                                <p className="text-base">{selectedOrderDetails.notes || 'Nenhuma observação'}</p>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button onClick={() => setIsDetailsDialogOpen(false)}>Fechar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
