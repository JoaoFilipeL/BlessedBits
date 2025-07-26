"use client"
import { useState, useEffect, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Search } from "lucide-react"
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';


type OrderStatus = "em análise" | "em produção" | "pronto" | "cancelado"

const statusColors: Record<OrderStatus, string> = {
    "em análise": "bg-yellow-100 text-yellow-800 hover:bg-yellow-200",
    "em produção": "bg-blue-100 text-blue-800 hover:bg-blue-200",
    pronto: "bg-green-100 text-green-800 hover:bg-green-200",
    cancelado: "bg-red-100 text-red-800 hover:bg-red-200",
}

interface OrderItem {
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

export function OrdersTable() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const supabase = createClientComponentClient();

    const fetchRecentOrders = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { data: ordersData, error: ordersError } = await supabase
                .from('orders')
                .select('*') 
                .order('created_at', { ascending: false })
                .limit(5); 

            if (ordersError) {
                console.error("Erro ao buscar pedidos recentes:", ordersError);
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
                console.error("Erro ao buscar itens de pedidos recentes:", orderItemsError);
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
            console.error("Erro inesperado ao buscar pedidos recentes:", err);
            setError(err.message || "Erro ao carregar pedidos recentes.");
        } finally {
            setLoading(false);
        }
    }, [supabase]);

    useEffect(() => {
        fetchRecentOrders();

        const ordersChannel = supabase
            .channel('dashboard_recent_orders_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'orders' },
                (payload) => {
                    console.log('Mudança em pedidos recentes em tempo real!', payload);
                    fetchRecentOrders(); 
                }
            )
            .subscribe();

        const orderItemsChannel = supabase
            .channel('dashboard_recent_order_items_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'order_items' },
                (payload) => {
                    console.log('Mudança em itens de pedidos recentes em tempo real!', payload);
                    fetchRecentOrders(); 
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(ordersChannel);
            supabase.removeChannel(orderItemsChannel);
        };
    }, [supabase, fetchRecentOrders]);

    const filteredOrders = orders.filter(
        (order) =>
            order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.id.toString().includes(searchTerm) || 
            order.customer_phone.toLowerCase().includes(searchTerm.toLowerCase()), 
    );

    const formatItemsForDisplay = (orderItems: OrderItem[]) => {
        return orderItems.map((item) => `${item.quantity}x ${item.product_name}`).join(", ");
    };

    const formatOrderId = (id: number) => {
        return `PED-${id.toString().padStart(4, '0')}`; 
    };

    const formatDeliveryDate = (dateString: string | null) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString + 'T00:00:00'); 
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0'); 
        const year = date.getFullYear();
        return `${day}/${month}/${year}`; 
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


    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                    <h2 className="text-xl font-semibold">Pedidos Recentes</h2>
                    <Badge variant="outline" className="ml-2">
                        {orders.length} total
                    </Badge>
                </div>
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
            </div>
            <div className="rounded-md border overflow-x-auto">
                <Table className="min-w-full">
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[100px] min-w-[100px]">Pedido</TableHead>
                            <TableHead className="min-w-[120px]">Cliente</TableHead>
                            <TableHead className="hidden sm:table-cell min-w-[120px]">Telefone</TableHead>
                            <TableHead className="min-w-[150px]">Itens</TableHead>
                            <TableHead className="min-w-[80px]">Total</TableHead>
                            <TableHead className="min-w-[80px]">Status</TableHead>
                            <TableHead className="hidden md:table-cell min-w-[120px]">Entrega</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={7} className="h-24 text-center">Carregando pedidos...</TableCell></TableRow> 
                        ) : error ? (
                            <TableRow><TableCell colSpan={7} className="h-24 text-center text-red-500">{error}</TableCell></TableRow> 
                        ) : filteredOrders.length === 0 ? (
                            <TableRow><TableCell colSpan={7} className="h-24 text-center">Nenhum pedido encontrado.</TableCell></TableRow> 
                        ) : (
                            filteredOrders.map((order) => (
                                <TableRow key={order.id}>
                                    <TableCell className="font-medium whitespace-nowrap">{formatOrderId(order.id)}</TableCell>
                                    <TableCell className="whitespace-nowrap">{order.customer_name}</TableCell>
                                    <TableCell className="hidden sm:table-cell whitespace-nowrap">{formatPhoneNumberUS(order.customer_phone)}</TableCell> 
                                    <TableCell className="max-w-[150px] truncate md:whitespace-normal" title={formatItemsForDisplay(order.items)}>
                                        {formatItemsForDisplay(order.items)}
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap">$ {order.total_amount.toFixed(2)}</TableCell>
                                    <TableCell className="whitespace-nowrap">
                                        <Badge variant="outline" className={statusColors[order.status]}>
                                            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell whitespace-nowrap">
                                        {formatDeliveryDate(order.delivery_date)}
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
