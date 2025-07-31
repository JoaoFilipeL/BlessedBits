"use client"
import type React from "react"
import { useState, useEffect, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Search, Plus, Minus, RefreshCw, Eye, Trash2, Edit } from "lucide-react"
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
import { CustomersList, Customer } from '@/components/customers/customers-list'; 

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
    customer_id: string | null; 
    customer_name: string; 
    customer_phone: string; 
    address: string | null;
    notes: string | null;
    total_amount: number;
    status: OrderStatus;
    created_at: string;
    delivery_date: string | null; 
    delivery_time: string | null; 
    delivery_fee: number; 
    items: OrderItem[];
}

export function OrdersList() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [products, setProducts] = useState<Product[]>([]); 
    const [combos, setCombos] = useState<ProductCombo[]>([]); 
    const [customers, setCustomers] = useState<Customer[]>([]); 
    const [searchTerm, setSearchTerm] = useState("");
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState<OrderStatus | "todos">("todos");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [addFormError, setAddFormError] = useState<string | null>(null);

    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState<Order | null>(null);
    const [editCustomerId, setEditCustomerId] = useState<string | null>(null); 
    const [editAddress, setEditAddress] = useState("");
    const [editNotes, setEditNotes] = useState("");
    const [editItems, setEditItems] = useState<OrderItem[]>([]);
    const [editDeliveryDate, setEditDeliveryDate] = useState("");
    const [editDeliveryTime, setEditDeliveryTime] = useState(""); 
    const [editDeliveryFee, setEditDeliveryFee] = useState("0.00");
    const [editSelectedProductOrComboId, setEditSelectedProductOrComboId] = useState<string>("");
    const [editItemQuantity, setEditItemQuantity] = useState(1);
    const [editFormError, setEditFormError] = useState<string | null>(null);


    const getTodayDateLocal = () => {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null); 
    const [address, setAddress] = useState("");
    const [notes, setNotes] = useState("");
    const [items, setItems] = useState<OrderItem[]>([]); 
    const [selectedProductOrComboId, setSelectedProductOrComboId] = useState<string>(""); 
    const [itemQuantity, setItemQuantity] = useState(1);
    const [deliveryDate, setDeliveryDate] = useState(getTodayDateLocal()); 
    const [deliveryTime, setDeliveryTime] = useState("12:00"); 
    const [deliveryFee, setDeliveryFee] = useState("0.00"); 

    const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
    const [selectedOrderDetails, setSelectedOrderDetails] = useState<Order | null>(null);

    const [isMapSelectionDialogOpen, setIsMapSelectionDialogOpen] = useState(false);
    const [addressToNavigate, setAddressToNavigate] = useState<string | null>(null);

    const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false); 

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

    const fetchCustomersData = useCallback(async () => {
        try {
            const userId = await getUserId();
            if (!userId) {
                console.error("Usuário não autenticado para buscar clientes.");
                return;
            }
            const { data, error: fetchError } = await supabase
                .from('customers')
                .select('*')
                .eq('user_id', userId)
                .order('name', { ascending: true });
            if (fetchError) throw fetchError;
            setCustomers(data as Customer[]);
        } catch (err: any) {
            console.error("Erro ao buscar clientes:", err);
            setError(err.message || "Erro ao carregar clientes.");
        }
    }, [supabase, getUserId]);

    const fetchOrders = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { data: ordersData, error: ordersError } = await supabase
                .from('orders')
                .select('*, customers(name, phone)') 
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

                const customerData = order.customers as { name: string, phone: string } | null;

                return {
                    id: order.id,
                    customer_id: order.customer_id, 
                    customer_name: customerData?.name || 'Cliente Removido', 
                    customer_phone: customerData?.phone || 'N/A', 
                    address: order.address,
                    notes: order.notes,
                    total_amount: parseFloat(order.total_amount),
                    status: order.status as OrderStatus,
                    created_at: order.created_at,
                    delivery_date: order.delivery_date, 
                    delivery_time: order.delivery_time || null, 
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
        fetchCustomersData(); 
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

        const customersChannel = supabase 
            .channel('customers_changes_orders')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'customers' },
                (payload) => {
                    console.log('Mudança em clientes para pedidos em tempo real!', payload);
                    fetchCustomersData();
                    fetchOrders(); 
                }
            )
            .subscribe();


        return () => {
            supabase.removeChannel(ordersChannel);
            supabase.removeChannel(orderItemsChannel);
            supabase.removeChannel(stockChannel);
            supabase.removeChannel(combosChannel); 
            supabase.removeChannel(customersChannel); 
        };
    }, [supabase, fetchProductsAndCombos, fetchOrders, fetchCustomersData]);

    const handleCustomerSelect = (customerId: string) => {
        setSelectedCustomerId(customerId);
        const customer = customers.find(c => c.id === customerId);
        if (customer) {
            setAddress(customer.address || "");
            setNotes(customer.notes || ""); 
        } else {
            setAddress("");
            setNotes("");
        }
    };

    const handleEditCustomerSelect = (customerId: string) => {
        setEditCustomerId(customerId);
        const customer = customers.find(c => c.id === customerId);
        if (customer) {
            setEditAddress(customer.address || "");
            setEditNotes(customer.notes || ""); 
        } else {
            setEditAddress("");
            setEditNotes("");
        }
    };

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

    const calculateTotal = (currentItems: OrderItem[], currentDeliveryFee: string) => {
        let total = currentItems.reduce((sum, item) => sum + item.product_price * item.quantity, 0);
        total += parseFloat(currentDeliveryFee);
        return total;
    };


    const formatItemsForDisplay = (orderItems: OrderItem[]) => {
        return orderItems.map((item) => `${item.quantity}x ${item.product_name}`).join(", ");
    };

    const formatOrderId = (id: number) => {
        return `PED-${id.toString().padStart(4, '0')}`;
    };

    const addNewOrder = async () => {
        setAddFormError(null); 
        if (items.length === 0 || !selectedCustomerId) { 
            setAddFormError("Por favor, selecione um cliente e adicione pelo menos um item ao pedido.");
            return;
        }

        const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
        if (!selectedCustomer) {
            setAddFormError("Cliente selecionado não encontrado.");
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
                    customer_id: selectedCustomerId, 
                    customer_name: selectedCustomer.name, 
                    customer_phone: selectedCustomer.phone, 
                    address: address || null,
                    notes: notes || null,
                    total_amount: calculateTotal(items, deliveryFee), 
                    status: "pronto", 
                    delivery_date: deliveryDate, 
                    delivery_time: deliveryTime, 
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

            if (orderData.status === "pronto") {
                const userId = await getUserId();
                if (userId) {
                    const { error: insertFinancialError } = await supabase
                        .from('financial_transactions')
                        .insert({
                            transaction_date: orderData.delivery_date, 
                            description: `Venda do Pedido ${formatOrderId(orderData.id)}`,
                            category: 'venda',
                            amount: orderData.total_amount,
                            type: 'receita',
                            order_id: orderData.id,
                            user_id: userId,
                        });
                    if (insertFinancialError) {
                        console.error("Erro ao registrar transação de venda:", insertFinancialError);
                    }
                }
            }


            setSelectedCustomerId(null); 
            setAddress("");
            setNotes("");
            setItems([]);
            setSelectedProductOrComboId("");
            setItemQuantity(1);
            setDeliveryDate(getTodayDateLocal()); 
            setDeliveryTime("12:00");
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
                .select('total_amount, status, delivery_date, items:order_items(product_id, quantity, is_combo_item)') 
                .eq('id', orderId)
                .single();

            if (fetchOrderDetailsError) throw fetchOrderDetailsError;

            const oldStatus = orderDetails.status;
            const orderTotalAmount = orderDetails.total_amount;
            const orderDeliveryDate = orderDetails.delivery_date; 
            const orderItems = orderDetails.items; 

            if (newStatus === "pronto" && oldStatus !== "pronto") {
                const { error: insertFinancialError } = await supabase
                    .from('financial_transactions')
                    .insert({
                        transaction_date: orderDeliveryDate, 
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
                        transaction_date: orderDeliveryDate,
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

    const openEditDialog = (order: Order) => {
        setEditingOrder(order);
        setEditCustomerId(order.customer_id); 
        setEditAddress(order.address || "");
        setEditNotes(order.notes || "");
        setEditItems(order.items);
        setEditDeliveryDate(order.delivery_date || getTodayDateLocal());
        setEditDeliveryTime(order.delivery_time || "12:00"); 
        setEditDeliveryFee(order.delivery_fee.toFixed(2));
        setEditFormError(null);
        setIsEditDialogOpen(true);
    };

    const handleEditItemQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(e.target.value);
        if (!isNaN(value) && value >= 1) {
            setEditItemQuantity(value);
        } else if (e.target.value === "") {
            setEditItemQuantity(1);
        }
    };

    const editIncrementQuantity = () => {
        setEditItemQuantity((prev) => prev + 1);
    };

    const editDecrementQuantity = () => {
        setEditItemQuantity((prev) => (prev > 1 ? prev - 1 : 1));
    };

    const editAddItem = () => {
        setEditFormError(null);
        if (!editSelectedProductOrComboId) {
            setEditFormError("Por favor, selecione um produto ou combo.");
            return;
        }

        const product = products.find((p) => p.id === editSelectedProductOrComboId);
        const combo = combos.find((c) => c.id === editSelectedProductOrComboId);

        if (!product && !combo) {
            setEditFormError("Produto ou combo selecionado não encontrado.");
            return;
        }

        if (product) {
            if (product.quantity !== undefined && editItemQuantity > product.quantity) {
                setEditFormError(`Estoque insuficiente para ${product.name}. Disponível: ${product.quantity}`);
                return;
            }

            const existingItemIndex = editItems.findIndex((item) => item.product_id === product.id && !item.is_combo_item);

            if (existingItemIndex >= 0) {
                const updatedItems = [...editItems];
                const newTotalQuantity = updatedItems[existingItemIndex].quantity + editItemQuantity;
                if (product.quantity !== undefined && newTotalQuantity > product.quantity) {
                    setEditFormError(`Estoque insuficiente para ${product.name}. Você já tem ${updatedItems[existingItemIndex].quantity} e quer adicionar ${editItemQuantity}. Disponível total: ${product.quantity}`);
                    return;
                }
                updatedItems[existingItemIndex].quantity = newTotalQuantity;
                setEditItems(updatedItems);
            } else {
                setEditItems([
                    ...editItems,
                    {
                        product_id: product.id,
                        product_name: product.name,
                        product_price: product.price,
                        quantity: editItemQuantity,
                        is_combo_item: false,
                    },
                ]);
            }
        } else if (combo) {
            for (const comboPart of combo.items) {
                const productInStock = products.find(p => p.id === comboPart.product_id);
                const requiredQuantity = comboPart.quantity * editItemQuantity;

                if (!productInStock || (productInStock.quantity !== undefined && productInStock.quantity < requiredQuantity)) {
                    setEditFormError(`Estoque insuficiente para "${productInStock?.name || 'Produto Desconhecido'}" no combo "${combo.name}". Necessário: ${requiredQuantity}, Disponível: ${productInStock?.quantity || 0}`);
                    return;
                }
            }

            setEditItems([
                ...editItems,
                {
                    product_id: combo.id,
                    product_name: combo.name,
                    product_price: combo.price,
                    quantity: editItemQuantity,
                    is_combo_item: true,
                },
            ]);
        }

        setEditSelectedProductOrComboId("");
        setEditItemQuantity(1);
        setEditFormError(null);
    };

    const editRemoveItem = (index: number) => {
        setEditItems(editItems.filter((_, i) => i !== index));
    };

    const updateOrder = async () => {
        setEditFormError(null);
        if (!editingOrder) return;

        if (editItems.length === 0 || !editCustomerId) { 
            setEditFormError("Por favor, selecione um cliente e adicione pelo menos um item ao pedido.");
            return;
        }

        const selectedCustomer = customers.find(c => c.id === editCustomerId);
        if (!selectedCustomer) {
            setEditFormError("Cliente selecionado não encontrado.");
            return;
        }

        try {
            const { data: currentOrderItemsDB, error: fetchCurrentItemsError } = await supabase
                .from('order_items')
                .select('product_id, quantity, is_combo_item')
                .eq('order_id', editingOrder.id);

            if (fetchCurrentItemsError) throw fetchCurrentItemsError;

            const currentItemsMap = new Map<string, { quantity: number, is_combo_item: boolean }>();
            currentOrderItemsDB.forEach(item => {
                currentItemsMap.set(item.product_id, { quantity: item.quantity, is_combo_item: item.is_combo_item || false });
            });

            const newItemsMap = new Map<string, { quantity: number, is_combo_item: boolean }>();
            editItems.forEach(item => {
                newItemsMap.set(item.product_id, { quantity: item.quantity, is_combo_item: item.is_combo_item || false });
            });

            const productsToAdjust: { id: string; quantityChange: number }[] = [];

            for (const [productId, newItem] of newItemsMap.entries()) {
                const currentItem = currentItemsMap.get(productId);
                if (currentItem) {
                    const quantityDiff = newItem.quantity - currentItem.quantity;
                    if (quantityDiff !== 0) {
                        if (newItem.is_combo_item) {
                            const combo = combos.find(c => c.id === productId);
                            if (combo) {
                                combo.items.forEach(cItem => {
                                    productsToAdjust.push({ id: cItem.product_id, quantityChange: cItem.quantity * quantityDiff });
                                });
                            }
                        } else {
                            productsToAdjust.push({ id: productId, quantityChange: quantityDiff });
                        }
                    }
                } else {
                    if (newItem.is_combo_item) {
                        const combo = combos.find(c => c.id === productId);
                        if (combo) {
                            combo.items.forEach(cItem => {
                                productsToAdjust.push({ id: cItem.product_id, quantityChange: cItem.quantity * newItem.quantity });
                            });
                        }
                    } else {
                        productsToAdjust.push({ id: productId, quantityChange: newItem.quantity });
                    }
                }
            }

            for (const [productId, currentItem] of currentItemsMap.entries()) {
                if (!newItemsMap.has(productId)) {
                    if (currentItem.is_combo_item) {
                        const combo = combos.find(c => c.id === productId);
                        if (combo) {
                            combo.items.forEach(cItem => {
                                productsToAdjust.push({ id: cItem.product_id, quantityChange: -cItem.quantity * currentItem.quantity });
                            });
                        }
                    } else {
                        productsToAdjust.push({ id: productId, quantityChange: -currentItem.quantity });
                    }
                }
            }

            const consolidatedAdjustments = new Map<string, number>();
            productsToAdjust.forEach(adj => {
                consolidatedAdjustments.set(adj.id, (consolidatedAdjustments.get(adj.id) || 0) + adj.quantityChange);
            });

            const productIdsToFetch = Array.from(consolidatedAdjustments.keys());
            if (productIdsToFetch.length > 0) {
                const { data: currentStock, error: stockFetchError } = await supabase
                    .from('stock')
                    .select('id, quantity')
                    .in('id', productIdsToFetch);

                if (stockFetchError) throw stockFetchError;

                for (const [productId, change] of consolidatedAdjustments.entries()) {
                    const stockProduct = currentStock.find(s => s.id === productId);
                    const currentQuantity = stockProduct?.quantity || 0;
                    const newCalculatedQuantity = currentQuantity - change; 

                    if (newCalculatedQuantity < 0) {
                        const productName = products.find(p => p.id === productId)?.name || "Produto Desconhecido";
                        setEditFormError(`Estoque insuficiente para ${productName}. Necessário: ${-change}, Disponível: ${currentQuantity}`);
                        return;
                    }
                }
            }
            
            const newTotalAmount = calculateTotal(editItems, editDeliveryFee);
            const { error: updateOrderError } = await supabase
                .from('orders')
                .update({
                    customer_id: editCustomerId, 
                    customer_name: selectedCustomer.name, 
                    customer_phone: selectedCustomer.phone, 
                    address: editAddress || null,
                    notes: editNotes || null,
                    total_amount: newTotalAmount,
                    delivery_date: editDeliveryDate,
                    delivery_time: editDeliveryTime, 
                    delivery_fee: parseFloat(editDeliveryFee),
                })
                .eq('id', editingOrder.id);

            if (updateOrderError) throw updateOrderError;

            const { error: deleteItemsError } = await supabase
                .from('order_items')
                .delete()
                .eq('order_id', editingOrder.id);

            if (deleteItemsError) throw deleteItemsError;

            const orderItemsToInsert = editItems.map(item => ({
                order_id: editingOrder.id,
                product_id: item.product_id,
                product_name: item.product_name,
                product_price: item.product_price,
                quantity: item.quantity,
                is_combo_item: item.is_combo_item,
            }));

            const { error: insertItemsError } = await supabase
                .from('order_items')
                .insert(orderItemsToInsert);

            if (insertItemsError) throw insertItemsError;

            const updateStockPromises = Array.from(consolidatedAdjustments.entries()).map(async ([productId, change]) => {
                const { data: stockProduct, error: fetchStockError } = await supabase
                    .from('stock')
                    .select('quantity')
                    .eq('id', productId)
                    .single();

                if (fetchStockError) throw fetchStockError;

                const newQuantity = (stockProduct?.quantity || 0) - change;
                const { error: updateError } = await supabase
                    .from('stock')
                    .update({ quantity: newQuantity })
                    .eq('id', productId);

                if (updateError) {
                    console.error(`Erro ao atualizar estoque para ${productId}:`, updateError);
                    throw new Error(`Falha ao atualizar estoque para ${productId}`);
                }
            });
            await Promise.all(updateStockPromises);

            if (editingOrder.status === "pronto") {
                const userId = await getUserId();
                if (userId) {
                    const { error: updateFinancialError } = await supabase
                        .from('financial_transactions')
                        .update({
                            transaction_date: editDeliveryDate, 
                            amount: newTotalAmount,
                        })
                        .eq('order_id', editingOrder.id)
                        .eq('user_id', userId);

                    if (updateFinancialError) {
                        console.error("Erro ao atualizar transação financeira:", updateFinancialError);
                    }
                }
            }


            setIsEditDialogOpen(false);
            setEditingOrder(null);
            setEditFormError(null);
        } catch (err: any) {
            console.error("Erro ao atualizar pedido:", err);
            setEditFormError(err.message || "Erro ao atualizar pedido.");
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

    const handleCustomerAdded = (newCustomer: Customer) => {
        setCustomers(prev => [...prev, newCustomer]); 
        setSelectedCustomerId(newCustomer.id); 
        setIsAddCustomerModalOpen(false); 
    };

    const getCustomerNameById = (customerId: string | null) => {
        const customer = customers.find(c => c.id === customerId);
        return customer ? customer.name : 'Cliente Removido';
    };

    const getCustomerPhoneById = (customerId: string | null) => {
        const customer = customers.find(c => c.id === customerId);
        return customer ? customer.phone : 'N/A';
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
                                    <div className="space-y-2 col-span-2"> 
                                        <Label htmlFor="customerSelect">Cliente</Label>
                                        <div className="flex gap-2">
                                            <Select value={selectedCustomerId || ""} onValueChange={handleCustomerSelect}>
                                                <SelectTrigger id="customerSelect" className="flex-grow">
                                                    <SelectValue placeholder="Selecione um cliente existente" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {customers.length === 0 ? (
                                                        <SelectItem value="no-customers" disabled>Nenhum cliente cadastrado</SelectItem>
                                                    ) : (
                                                        customers.map(customer => (
                                                            <SelectItem key={customer.id} value={customer.id}>
                                                                {customer.name} ({customer.phone})
                                                            </SelectItem>
                                                        ))
                                                    )}
                                                </SelectContent>
                                            </Select>
                                            <Button type="button" variant="outline" onClick={() => setIsAddCustomerModalOpen(true)}>
                                                <Plus className="h-4 w-4 mr-2" /> Adicionar Cliente
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="customerName">Nome do Cliente</Label>
                                        <Input
                                            id="customerName"
                                            placeholder="Nome completo"
                                            value={getCustomerNameById(selectedCustomerId)} 
                                            readOnly 
                                            className="bg-gray-100"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="customerPhone">Telefone</Label>
                                        <Input
                                            id="customerPhone"
                                            placeholder="(000) 000-0000"
                                            value={getCustomerPhoneById(selectedCustomerId)} 
                                            readOnly 
                                            className="bg-gray-100"
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
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                                        <Label htmlFor="deliveryTime">Hora de Entrega</Label>
                                        <Input
                                            id="deliveryTime"
                                            type="time"
                                            value={deliveryTime}
                                            onChange={(e) => setDeliveryTime(e.target.value)}
                                        />
                                    </div>
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
                                                <div>$ {calculateTotal(items, deliveryFee).toFixed(2)}</div>
                                            </div>
                                            {parseFloat(deliveryFee) > 0 && (
                                                <div className="flex justify-between items-center text-sm">
                                                    <div>Taxa de Entrega</div>
                                                    <div>$ {parseFloat(deliveryFee).toFixed(2)}</div>
                                                </div>
                                            )}
                                            <div className="flex justify-between items-center pt-2 font-bold text-lg">
                                                <div>Total Geral</div>
                                                <div>$ {calculateTotal(items, deliveryFee).toFixed(2)}</div>
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
                                <Button onClick={addNewOrder} disabled={items.length === 0 || !selectedCustomerId}>
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
                                    <TableCell>{getCustomerNameById(order.customer_id)}</TableCell> 
                                    <TableCell>{getCustomerPhoneById(order.customer_id)}</TableCell> 
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
                                        {order.delivery_date && order.delivery_time ? `${formatDateForDisplay(order.delivery_date)} ${order.delivery_time}` : formatDateForDisplay(order.delivery_date)}
                                    </TableCell> 
                                    <TableCell className="text-right flex items-center justify-end gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => openOrderDetailsDialog(order)}
                                        >
                                            <Eye className="h-3 w-3 mr-1" /> Detalhes
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => openEditDialog(order)} 
                                        >
                                            <Edit className="h-3 w-3 mr-1" /> Editar
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
                                    <p className="text-base">{getCustomerNameById(selectedOrderDetails.customer_id)}</p>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium">Telefone:</Label>
                                    <p className="text-base">{getCustomerPhoneById(selectedOrderDetails.customer_id)}</p> 
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
                                <p className="text-base">{selectedOrderDetails.delivery_date && selectedOrderDetails.delivery_time ? `${formatDateForDisplay(selectedOrderDetails.delivery_date)} ${selectedOrderDetails.delivery_time}` : formatDateForDisplay(selectedOrderDetails.delivery_date)}</p>
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
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="max-w-3xl w-[90%]">
                    <DialogHeader>
                        <DialogTitle>Editar Pedido: {editingOrder ? formatOrderId(editingOrder.id) : ''}</DialogTitle>
                        <DialogDescription>Edite os detalhes do pedido.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-6 py-4 overflow-y-auto max-h-[70vh] pr-4">
                        {editFormError && (
                            <div className="bg-red-100 text-red-700 p-3 rounded-md text-sm">
                                {editFormError}
                            </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2 col-span-2">
                                <Label htmlFor="editCustomerSelect">Cliente</Label>
                                <div className="flex gap-2">
                                    <Select value={editCustomerId || ""} onValueChange={handleEditCustomerSelect}>
                                        <SelectTrigger id="editCustomerSelect" className="flex-grow">
                                            <SelectValue placeholder="Selecione um cliente existente" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {customers.length === 0 ? (
                                                <SelectItem value="no-customers" disabled>Nenhum cliente cadastrado</SelectItem>
                                            ) : (
                                                customers.map(customer => (
                                                    <SelectItem key={customer.id} value={customer.id}>
                                                        {customer.name} ({customer.phone})
                                                    </SelectItem>
                                                ))
                                            )}
                                        </SelectContent>
                                    </Select>
                                    <Button type="button" variant="outline" onClick={() => setIsAddCustomerModalOpen(true)}>
                                        <Plus className="h-4 w-4 mr-2" /> Adicionar Cliente
                                    </Button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="editCustomerName">Nome do Cliente</Label>
                                <Input
                                    id="editCustomerName"
                                    placeholder="Nome completo"
                                    value={getCustomerNameById(editCustomerId)} 
                                    readOnly
                                    className="bg-gray-100"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="editCustomerPhone">Telefone</Label>
                                <Input
                                    id="editCustomerPhone"
                                    placeholder="(000) 000-0000"
                                    value={getCustomerPhoneById(editCustomerId)} 
                                    readOnly
                                    className="bg-gray-100"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="editAddress">Endereço de Entrega (opcional)</Label>
                            <Textarea
                                id="editAddress"
                                placeholder="Endereço completo"
                                value={editAddress}
                                onChange={(e) => setEditAddress(e.target.value)}
                                rows={2}
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="editDeliveryDate">Data de Entrega</Label>
                                <Input
                                    id="editDeliveryDate"
                                    type="date"
                                    value={editDeliveryDate}
                                    onChange={(e) => setEditDeliveryDate(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="editDeliveryTime">Hora de Entrega</Label>
                                <Input
                                    id="editDeliveryTime"
                                    type="time"
                                    value={editDeliveryTime}
                                    onChange={(e) => setEditDeliveryTime(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="editDeliveryFee">Taxa de Entrega ($)</Label>
                            <Input
                                id="editDeliveryFee"
                                type="number"
                                step="0.01"
                                min="0"
                                value={editDeliveryFee}
                                onChange={(e) => setEditDeliveryFee(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Itens do Pedido</Label>
                            <div className="flex flex-wrap items-center gap-2 w-full">
                                <Select value={editSelectedProductOrComboId} onValueChange={setEditSelectedProductOrComboId}>
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
                                        onClick={editDecrementQuantity}
                                        disabled={editItemQuantity <= 1}
                                        className="h-10 w-10 rounded-r-none"
                                    >
                                        <Minus className="h-4 w-4" />
                                    </Button>
                                    <Input
                                        type="number"
                                        min="1"
                                        value={editItemQuantity}
                                        onChange={(e) => setEditItemQuantity(parseInt(e.target.value) || 1)}
                                        className="w-16 text-center h-10 rounded-none border border-l-0 border-r-0"
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        onClick={editIncrementQuantity}
                                        className="h-10 w-10 rounded-l-none"
                                    >
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </div>
                                <Button type="button" onClick={editAddItem} disabled={!editSelectedProductOrComboId || editItemQuantity <= 0} className="w-full sm:w-auto">
                                    Adicionar
                                </Button>
                            </div>
                        </div>
                        {editItems.length > 0 && (
                            <div className="space-y-2 border rounded-md p-4">
                                <Label>Itens Atuais</Label>
                                <div className="space-y-2">
                                    {editItems.map((item, index) => (
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
                                                    onClick={() => editRemoveItem(index)}
                                                >
                                                    ✕
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                    <div className="flex justify-between items-center pt-2 font-bold">
                                        <div>Subtotal</div>
                                        <div>$ {calculateTotal(editItems, editDeliveryFee).toFixed(2)}</div>
                                    </div>
                                    {parseFloat(editDeliveryFee) > 0 && (
                                        <div className="flex justify-between items-center text-sm">
                                            <div>Taxa de Entrega</div>
                                            <div>$ {parseFloat(editDeliveryFee).toFixed(2)}</div>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center pt-2 font-bold text-lg">
                                        <div>Total Geral</div>
                                        <div>$ {calculateTotal(editItems, editDeliveryFee).toFixed(2)}</div>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="editNotes">Observações (opcional)</Label>
                            <Textarea
                                id="editNotes"
                                placeholder="Observações sobre o pedido"
                                value={editNotes}
                                onChange={(e) => setEditNotes(e.target.value)}
                                rows={2}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={updateOrder}>
                            Salvar Alterações
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog open={isAddCustomerModalOpen} onOpenChange={setIsAddCustomerModalOpen}>
                <DialogContent className="max-w-md w-[90%]">
                    <CustomersList
                        isModal={true}
                        onCloseModal={() => setIsAddCustomerModalOpen(false)}
                        onCustomerAdded={handleCustomerAdded}
                    />
                </DialogContent>
            </Dialog>
        </div>
    )
}
