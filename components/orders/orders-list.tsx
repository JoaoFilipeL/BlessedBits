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

interface ComboItemDB {
    product_id: string;
    quantity: number;
}

interface ProductCombo {
    id: string;
    name: string;
    description: string | null;
    price: number;
    items: ComboItemDB[]; 
}

interface OrderItem {
    order_id?: number; 
    product_id: string;
    product_name: string;
    product_price: number;
    quantity: number;
    is_combo_item?: boolean; 
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
    delivery_date: string | null; 
    delivery_fee: number; 
    items: OrderItem[];
}

export function OrdersList() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [products, setProducts] = useState<Product[]>([]); 
    const [combos, setCombos] = useState<ProductCombo[]>([]); 
    const [searchTerm, setSearchTerm] = useState("");
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState<OrderStatus | "todos">("todos");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [addFormError, setAddFormError] = useState<string | null>(null);

    const getTodayDateLocal = () => {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const [customerName, setCustomerName] = useState("");
    const [customerPhone, setCustomerPhone] = useState("");
    const [address, setAddress] = useState("");
    const [notes, setNotes] = useState("");
    const [items, setItems] = useState<OrderItem[]>([]); 
    const [selectedProductOrComboId, setSelectedProductOrComboId] = useState<string>(""); 
    const [itemQuantity, setItemQuantity] = useState(1);
    const [deliveryDate, setDeliveryDate] = useState(getTodayDateLocal()); 
    const [deliveryFee, setDeliveryFee] = useState("0.00"); 

    const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
    const [selectedOrderDetails, setSelectedOrderDetails] = useState<Order | null>(null);

    const [isMapSelectionDialogOpen, setIsMapSelectionDialogOpen] = useState(false);
    const [addressToNavigate, setAddressToNavigate] = useState<string | null>(null);


    const supabase = createClientComponentClient();

    const getUserId = useCallback(async () => {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
            console.error("Erro ao obter sessão do usuário:", sessionError);
            return null;
        }
        return session?.user?.id || null;
    }, [supabase]);

    const fetchProductsAndCombos = useCallback(async () => {
        try {
            const { data: productsData, error: productsError } = await supabase
                .from('stock')
                .select('id, name, price, quantity')
                .order('name', { ascending: true });

            if (productsError) throw productsError;
            setProducts(productsData.map(p => ({ id: p.id, name: p.name, price: parseFloat(p.price), quantity: p.quantity })));

            const { data: combosData, error: combosError } = await supabase
                .from('product_combos')
                .select('*')
                .order('name', { ascending: true });

            if (combosError) throw combosError;
            setCombos(combosData.map(c => ({
                id: c.id,
                name: c.name,
                description: c.description,
                price: parseFloat(c.price),
                items: typeof c.items === 'string' ? JSON.parse(c.items) : c.items
            })));

        } catch (err: any) {
            console.error("Erro ao buscar produtos/combos:", err);
            setError(err.message || "Erro ao carregar produtos e combos.");
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

            if (ordersError) throw ordersError;

            const orderIds = ordersData.map(order => order.id);
            const { data: orderItemsData, error: orderItemsError } = await supabase
                .from('order_items')
                .select('*')
                .in('order_id', orderIds);

            if (orderItemsError) throw orderItemsError;

            const combinedOrders: Order[] = ordersData.map(order => {
                const itemsForOrder: OrderItem[] = orderItemsData
                    .filter(item => item.order_id === order.id)
                    .map(item => ({
                        order_id: item.order_id, 
                        product_id: item.product_id,
                        product_name: item.product_name,
                        product_price: parseFloat(item.product_price),
                        quantity: item.quantity,
                        is_combo_item: item.is_combo_item || false, 
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
                    delivery_date: order.delivery_date, 
                    delivery_fee: parseFloat(order.delivery_fee || 0), 
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
        fetchProductsAndCombos(); 
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
                    fetchProductsAndCombos(); 
                }
            )
            .subscribe();
        
        const combosChannel = supabase
            .channel('product_combos_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'product_combos' },
                (payload) => {
                    console.log('Mudança em combos em tempo real!', payload);
                    fetchProductsAndCombos();
                }
            )
            .subscribe();


        return () => {
            supabase.removeChannel(ordersChannel);
            supabase.removeChannel(orderItemsChannel);
            supabase.removeChannel(stockChannel);
            supabase.removeChannel(combosChannel); 
        };
    }, [supabase, fetchProductsAndCombos, fetchOrders]);

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
        setAddFormError(null); 
        if (!selectedProductOrComboId) {
            setAddFormError("Por favor, selecione um produto ou combo.");
            return;
        }

        const product = products.find((p) => p.id === selectedProductOrComboId);
        const combo = combos.find((c) => c.id === selectedProductOrComboId);

        if (!product && !combo) {
            setAddFormError("Produto ou combo selecionado não encontrado.");
            return;
        }

        if (product) { 
            if (product.quantity !== undefined && itemQuantity > product.quantity) {
                setAddFormError(`Estoque insuficiente para ${product.name}. Disponível: ${product.quantity}`);
                return;
            }

            const existingItemIndex = items.findIndex((item) => item.product_id === product.id && !item.is_combo_item);

            if (existingItemIndex >= 0) {
                const updatedItems = [...items];
                const newTotalQuantity = updatedItems[existingItemIndex].quantity + itemQuantity;
                if (product.quantity !== undefined && newTotalQuantity > product.quantity) {
                    setAddFormError(`Estoque insuficiente para ${product.name}. Você já tem ${updatedItems[existingItemIndex].quantity} e quer adicionar ${itemQuantity}. Disponível total: ${product.quantity}`);
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
                        is_combo_item: false,
                    },
                ]);
            }
        } else if (combo) { 
            for (const comboPart of combo.items) {
                const productInStock = products.find(p => p.id === comboPart.product_id);
                const requiredQuantity = comboPart.quantity * itemQuantity; 

                if (!productInStock || (productInStock.quantity !== undefined && productInStock.quantity < requiredQuantity)) {
                    setAddFormError(`Estoque insuficiente para "${productInStock?.name || 'Produto Desconhecido'}" no combo "${combo.name}". Necessário: ${requiredQuantity}, Disponível: ${productInStock?.quantity || 0}`);
                    return; 
                }
            }

            setItems([
                ...items,
                {
                    product_id: combo.id, 
                    product_name: combo.name, 
                    product_price: combo.price,
                    quantity: itemQuantity,
                    is_combo_item: true, 
                },
            ]);
        }

        setSelectedProductOrComboId("");
        setItemQuantity(1);
        setAddFormError(null); 
    };

    const removeItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const calculateTotal = () => {
        let total = items.reduce((sum, item) => sum + item.product_price * item.quantity, 0);
        total += parseFloat(deliveryFee);
        return total;
    };

    const formatPhoneNumberUS = (value: string) => {
        const numericValue = value.replace(/\D/g, "");
        if (numericValue.length <= 3) {
            return numericValue;
        } else if (numericValue.length <= 6) {
            return `(${numericValue.slice(0, 3)}) ${numericValue.slice(3)}`;
        } else if (numericValue.length <= 10) {
            return `(${numericValue.slice(0, 3)}) ${numericValue.slice(3, 6)}-${numericValue.slice(6, 10)}`;
        } else {
            return `(${numericValue.slice(0, 3)}) ${numericValue.slice(3, 6)}-${numericValue.slice(6, 10)}`;
        }
    };


    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setCustomerPhone(formatPhoneNumberUS(e.target.value)); 
    };

    const formatItemsForDisplay = (orderItems: OrderItem[]) => {
        return orderItems.map((item) => `${item.quantity}x ${item.product_name}`).join(", ");
    };

    const formatOrderId = (id: number) => {
        return `PED-${id.toString().padStart(4, '0')}`;
    };

    const addNewOrder = async () => {
        setAddFormError(null); 
        if (items.length === 0 || !customerName || !customerPhone) {
            setAddFormError("Por favor, preencha o nome do cliente, telefone e adicione pelo menos um item ao pedido.");
            return;
        }

        try {
            const productsToDeduct: { id: string; quantity: number }[] = [];

            for (const orderItem of items) {
                if (orderItem.is_combo_item) {
                    const combo = combos.find(c => c.id === orderItem.product_id);
                    if (!combo) {
                        setAddFormError(`Combo "${orderItem.product_name}" não encontrado.`);
                        return;
                    }
                    combo.items.forEach(cItem => {
                        const existingDeduction = productsToDeduct.find(p => p.id === cItem.product_id);
                        if (existingDeduction) {
                            existingDeduction.quantity += cItem.quantity * orderItem.quantity;
                        } else {
                            productsToDeduct.push({ id: cItem.product_id, quantity: cItem.quantity * orderItem.quantity });
                        }
                    });
                } else {
                    const existingDeduction = productsToDeduct.find(p => p.id === orderItem.product_id); 
                    if (existingDeduction) {
                        existingDeduction.quantity += orderItem.quantity;
                    } else {
                        productsToDeduct.push({ id: orderItem.product_id, quantity: orderItem.quantity });
                    }
                }
            }

            const { data: currentStock, error: stockFetchError } = await supabase
                .from('stock')
                .select('id, quantity')
                .in('id', productsToDeduct.map(p => p.id));

            if (stockFetchError) throw stockFetchError;

            for (const deductItem of productsToDeduct) {
                const stockProduct = currentStock.find(s => s.id === deductItem.id);
                if (!stockProduct || stockProduct.quantity < deductItem.quantity) {
                    const productName = products.find(p => p.id === deductItem.id)?.name || "Produto Desconhecido";
                    setAddFormError(`Estoque insuficiente para ${productName}. Necessário: ${deductItem.quantity}, Disponível: ${stockProduct?.quantity || 0}`);
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
                    delivery_date: deliveryDate, 
                    delivery_fee: parseFloat(deliveryFee), 
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
                is_combo_item: item.is_combo_item, 
            }));

            const { error: orderItemsError } = await supabase
                .from('order_items')
                .insert(orderItemsToInsert);

            if (orderItemsError) throw orderItemsError;

            const updateStockPromises = productsToDeduct.map(async (deductItem) => {
                const stockProduct = currentStock.find(s => s.id === deductItem.id);
                const newQuantity = (stockProduct?.quantity || 0) - deductItem.quantity;

                const { error: updateError } = await supabase
                    .from('stock')
                    .update({ quantity: newQuantity })
                    .eq('id', deductItem.id);

                if (updateError) {
                    console.error(`Erro ao deduzir estoque para ${deductItem.id}:`, updateError);
                    throw new Error(`Falha ao deduzir estoque para ${deductItem.id}`);
                }
            });
            await Promise.all(updateStockPromises);

            setCustomerName("");
            setCustomerPhone("");
            setAddress("");
            setNotes("");
            setItems([]);
            setSelectedProductOrComboId("");
            setItemQuantity(1);
            setDeliveryDate(getTodayDateLocal()); 
            setDeliveryFee("0.00");
            setIsAddDialogOpen(false);
            setAddFormError(null); 
        } catch (err: any) {
            console.error("Erro ao registrar pedido ou deduzir estoque:", err);
            if (err instanceof Error) {
                console.error("Nome do erro:", err.name);
                console.error("Mensagem do erro:", err.message);
                console.error("Pilha de chamadas (stack):", err.stack);
            } else if (typeof err === 'object' && err !== null) {
                console.error("Propriedades do objeto de erro:", JSON.stringify(err, null, 2));
            } else {
                console.error("Tipo de erro desconhecido:", err);
            }
            setAddFormError(err.message || JSON.stringify(err) || "Erro desconhecido ao registrar pedido ou deduzir estoque.");
        }
    };

    const updateOrderStatus = async (orderId: number, newStatus: OrderStatus) => {
        try {
            const userId = await getUserId(); 
            if (!userId) {
                setError("Usuário não autenticado. Por favor, faça login.");
                return;
            }

            const { data: orderDetails, error: fetchOrderDetailsError } = await supabase
                .from('orders')
                .select('total_amount, status, items:order_items(product_id, quantity, is_combo_item)') 
                .eq('id', orderId)
                .single();

            if (fetchOrderDetailsError) throw fetchOrderDetailsError;

            const oldStatus = orderDetails.status;
            const orderTotalAmount = orderDetails.total_amount;
            const orderItems = orderDetails.items; 

            if (newStatus === "pronto" && oldStatus !== "pronto") {
                const { error: insertFinancialError } = await supabase
                    .from('financial_transactions')
                    .insert({
                        transaction_date: new Date().toISOString().split('T')[0], 
                        description: `Venda do Pedido ${formatOrderId(orderId)}`,
                        category: 'venda',
                        amount: orderTotalAmount,
                        type: 'receita',
                        order_id: orderId,
                        user_id: userId, 
                    });

                if (insertFinancialError) {
                    console.error("Erro ao registrar transação de venda:", insertFinancialError);
                }
            } else if (newStatus === "cancelado" && oldStatus !== "cancelado") {
                const productsToRevert: { id: string; quantity: number }[] = [];

                for (const orderItem of orderItems) {
                    if (orderItem.is_combo_item) {
                        const combo = combos.find(c => c.id === orderItem.product_id);
                        if (combo) {
                            combo.items.forEach(cItem => {
                                const existingRevert = productsToRevert.find(p => p.id === cItem.product_id);
                                if (existingRevert) {
                                    existingRevert.quantity += cItem.quantity * orderItem.quantity;
                                } else {
                                    productsToRevert.push({ id: cItem.product_id, quantity: cItem.quantity * orderItem.quantity });
                                }
                            });
                        } else {
                            console.warn(`Combo com ID ${orderItem.product_id} não encontrado ao reverter estoque. Estoque não será revertido para este combo.`);
                        }
                    } else {
                        const existingRevert = productsToRevert.find(p => p.id === orderItem.product_id);
                        if (existingRevert) {
                            existingRevert.quantity += orderItem.quantity;
                        } else {
                            productsToRevert.push({ id: orderItem.product_id, quantity: orderItem.quantity });
                        }
                    }
                }

                const revertStockPromises = productsToRevert.map(async (revertItem) => {
                    const { data: currentStockItem, error: stockError } = await supabase
                        .from('stock')
                        .select('quantity')
                        .eq('id', revertItem.id)
                        .single();

                    if (stockError) {
                        console.error(`Erro ao buscar estoque para ${revertItem.id} ao reverter:`, stockError);
                        throw stockError;
                    }

                    const newQuantity = (currentStockItem?.quantity || 0) + revertItem.quantity;

                    const { error: updateStockError } = await supabase
                        .from('stock')
                        .update({ quantity: newQuantity })
                        .eq('id', revertItem.id);

                    if (updateStockError) {
                        console.error(`Erro ao atualizar estoque para ${revertItem.id} ao reverter:`, updateStockError);
                        throw updateStockError;
                    }
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
                        user_id: userId, 
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

    const formatDateForDisplay = (dateString: string | null) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString + 'T00:00:00'); 
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0'); 
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    const formatOrderDate = (dateString: string) => {
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0'); 
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${day}/${month}/${year}, ${hours}:${minutes}`;
    };

    const getWazeLink = (address: string | null) => {
        if (!address) return '#';
        const encodedAddress = encodeURIComponent(address);
        return `https://www.waze.com/ul?q=${encodedAddress}&navigate=yes`;
    };

    const getGoogleMapsLink = (address: string | null) => {
        if (!address) return '#';
        const encodedAddress = encodeURIComponent(address);
        return `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`;
    };

    const handleAddressClick = (address: string | null) => {
        if (address) {
            setAddressToNavigate(address);
            setIsMapSelectionDialogOpen(true);
        }
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
                                {addFormError && (
                                    <div className="bg-red-100 text-red-700 p-3 rounded-md text-sm">
                                        {addFormError}
                                    </div>
                                )}
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
                                            placeholder="(000) 000-0000" 
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
                                    <Label htmlFor="deliveryDate">Data de Entrega</Label>
                                    <Input
                                        id="deliveryDate"
                                        type="date"
                                        value={deliveryDate}
                                        onChange={(e) => setDeliveryDate(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="deliveryFee">Taxa de Entrega ($)</Label>
                                    <Input
                                        id="deliveryFee"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={deliveryFee}
                                        onChange={(e) => setDeliveryFee(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Itens do Pedido</Label>
                                    <div className="flex flex-wrap items-center gap-2 w-full">
                                        <Select value={selectedProductOrComboId} onValueChange={setSelectedProductOrComboId}>
                                            <SelectTrigger className="flex-1 min-w-[180px]">
                                                <SelectValue placeholder="Selecione um produto ou combo" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <p className="px-4 py-2 text-sm font-semibold text-muted-foreground">Produtos</p>
                                                {products.map((product) => (
                                                    <SelectItem key={product.id} value={product.id} disabled={(product.quantity || 0) <= 0}>
                                                        {product.name} - $ {product.price.toFixed(2)} ({product.quantity !== undefined ? `${product.quantity} no estoque` : '...'})
                                                    </SelectItem>
                                                ))}
                                                <p className="px-4 py-2 text-sm font-semibold text-muted-foreground">Combos</p>
                                                {combos.map((combo) => (
                                                    <SelectItem key={combo.id} value={combo.id}>
                                                        {combo.name} - $ {combo.price.toFixed(2)}
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
                                                onChange={(e) => setItemQuantity(parseInt(e.target.value) || 1)} 
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
                                        <Button type="button" onClick={addItem} disabled={!selectedProductOrComboId || itemQuantity <= 0} className="w-full sm:w-auto">
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
                                                        {item.is_combo_item && <span className="text-xs text-muted-foreground ml-1">(Combo)</span>}
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
                                                <div>Subtotal</div>
                                                <div>$ {calculateTotal().toFixed(2)}</div>
                                            </div>
                                            {parseFloat(deliveryFee) > 0 && (
                                                <div className="flex justify-between items-center text-sm">
                                                    <div>Taxa de Entrega</div>
                                                    <div>$ {parseFloat(deliveryFee).toFixed(2)}</div>
                                                </div>
                                            )}
                                            <div className="flex justify-between items-center pt-2 font-bold text-lg">
                                                <div>Total Geral</div>
                                                <div>$ {(calculateTotal()).toFixed(2)}</div>
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
                            <TableHead>Entrega</TableHead> 
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={8} className="h-24 text-center">
                                    Carregando pedidos...
                                </TableCell>
                            </TableRow>
                        ) : error ? (
                            <TableRow>
                                <TableCell colSpan={8} className="h-24 text-center text-red-500"> 
                                    {error}
                                </TableCell>
                            </TableRow>
                        ) : filteredOrders.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="h-24 text-center"> 
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
                                    <TableCell>
                                        {formatDateForDisplay(order.delivery_date)}
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
                                {selectedOrderDetails.address ? (
                                    <p
                                        className="text-base text-blue-600 hover:underline cursor-pointer"
                                        onClick={() => handleAddressClick(selectedOrderDetails.address)}
                                    >
                                        {selectedOrderDetails.address}
                                    </p>
                                ) : (
                                    <p className="text-base">Não informado</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Itens do Pedido:</Label>
                                <ul className="list-disc pl-5">
                                    {selectedOrderDetails.items.map((item, index) => (
                                        <li key={index} className="text-base">
                                            {item.is_combo_item ? (
                                                <>
                                                    <span className="font-medium">{item.quantity}x {item.product_name}</span>
                                                    <ul className="list-disc pl-5 text-sm text-muted-foreground">
                                                        {combos.find(c => c.id === item.product_id)?.items.map((comboPart, idx) => (
                                                            <li key={idx}>
                                                                {comboPart.quantity}x {products.find(p => p.id === comboPart.product_id)?.name || 'Produto Desconhecido'}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </>
                                            ) : (
                                                <>
                                                    <span className="font-medium">{item.quantity}x {item.product_name}</span>
                                                    - $ {(item.product_price * item.quantity).toFixed(2)}
                                                </>
                                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Taxa de Entrega:</Label>
                                <p className="text-base">$ {selectedOrderDetails.delivery_fee.toFixed(2)}</p>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Total do Pedido:</Label>
                                <p className="text-lg font-bold">$ {selectedOrderDetails.total_amount.toFixed(2)}</p>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Data do Pedido:</Label>
                                <p className="text-base">{formatOrderDate(selectedOrderDetails.created_at)}</p>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Data de Entrega:</Label>
                                <p className="text-base">{formatDateForDisplay(selectedOrderDetails.delivery_date)}</p>
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
            <Dialog open={isMapSelectionDialogOpen} onOpenChange={setIsMapSelectionDialogOpen}>
                <DialogContent className="max-w-xs w-[90%]">
                    <DialogHeader>
                        <DialogTitle>Abrir Endereço</DialogTitle>
                        <DialogDescription>Como você gostaria de abrir o endereço?</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <Button
                            onClick={() => {
                                window.open(getWazeLink(addressToNavigate), "_blank");
                                setIsMapSelectionDialogOpen(false);
                            }}
                            className="bg-blue-500 text-white hover:bg-blue-600"
                        >
                            Abrir no Waze
                        </Button>
                        <Button
                            onClick={() => {
                                window.open(getGoogleMapsLink(addressToNavigate), "_blank");
                                setIsMapSelectionDialogOpen(false);
                            }}
                            className="bg-green-500 text-white hover:bg-green-600"
                        >
                            Abrir no Maps
                        </Button>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsMapSelectionDialogOpen(false)}>
                            Cancelar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
