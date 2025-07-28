"use client"
import { useState, useEffect, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Search, Eye } from "lucide-react" 
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
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


export function TodayOrdersTable() { 
    const [orders, setOrders] = useState<Order[]>([]);
    const [products, setProducts] = useState<Product[]>([]); 
    const [combos, setCombos] = useState<ProductCombo[]>([]); 
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
    const [selectedOrderDetails, setSelectedOrderDetails] = useState<Order | null>(null);

    const [isMapSelectionDialogOpen, setIsMapSelectionDialogOpen] = useState(false);
    const [addressToNavigate, setAddressToNavigate] = useState<string | null>(null);

    const supabase = createClientComponentClient();

    const getTodayDateLocal = () => {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const fetchProductsAndCombos = useCallback(async () => {
        try {
            const { data: productsData, error: productsError } = await supabase
                .from('stock')
                .select('id, name, price, quantity')
                .order('name', { ascending: true });

            if (productsError) throw productsError;
            setProducts(productsData.map((p: any) => ({ id: p.id, name: p.name, price: parseFloat(p.price), quantity: p.quantity }))); 

            const { data: combosData, error: combosError } = await supabase
                .from('product_combos')
                .select('*')
                .order('name', { ascending: true });

            if (combosError) throw combosError;
            setCombos(combosData.map((c: any) => ({ 
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


    const fetchTodayOrders = useCallback(async () => { 
        setLoading(true);
        setError(null);
        try {
            const today = getTodayDateLocal(); 

            const { data: ordersData, error: ordersError } = await supabase
                .from('orders')
                .select('*') 
                .eq('delivery_date', today) 
                .order('created_at', { ascending: false }); 

            if (ordersError) {
                console.error("Erro ao buscar pedidos de hoje:", ordersError);
                setError(ordersError.message);
                setLoading(false);
                return;
            }

            const orderIds = ordersData.map((order: any) => order.id); 
            const { data: orderItemsData, error: orderItemsError } = await supabase
                .from('order_items')
                .select('*')
                .in('order_id', orderIds);

            if (orderItemsError) {
                console.error("Erro ao buscar itens de pedidos de hoje:", orderItemsError);
                setError(orderItemsError.message);
                setLoading(false);
                return;
            }

            const combinedOrders: Order[] = ordersData.map((order: any) => { 
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
            console.error("Erro inesperado ao buscar pedidos de hoje:", err);
            setError(err.message || "Erro ao carregar pedidos de hoje.");
        } finally {
            setLoading(false);
        }
    }, [supabase]);

    useEffect(() => {
        fetchProductsAndCombos(); 
        fetchTodayOrders();

        const ordersChannel = supabase
            .channel('dashboard_today_orders_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'orders' },
                (payload) => {
                    console.log('Mudança em pedidos de hoje em tempo real!', payload);
                    fetchTodayOrders(); 
                }
            )
            .subscribe();

        const orderItemsChannel = supabase
            .channel('dashboard_today_order_items_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'order_items' },
                (payload) => {
                    console.log('Mudança em itens de pedidos de hoje em tempo real!', payload);
                    fetchTodayOrders(); 
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(ordersChannel);
            supabase.removeChannel(orderItemsChannel);
        };
    }, [supabase, fetchTodayOrders, fetchProductsAndCombos]);

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

    const openOrderDetailsDialog = (order: Order) => {
        setSelectedOrderDetails(order);
        setIsDetailsDialogOpen(true);
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
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                    <h2 className="text-xl font-semibold">Pedidos para Hoje</h2> 
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
            <div className="rounded-md border overflow-x-auto max-h-96"> 
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
                            <TableHead className="text-right min-w-[80px]">Ações</TableHead> 
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={8} className="h-24 text-center">Carregando pedidos...</TableCell></TableRow> 
                        ) : error ? (
                            <TableRow><TableCell colSpan={8} className="h-24 text-center text-red-500">{error}</TableCell></TableRow> 
                        ) : filteredOrders.length === 0 ? (
                            <TableRow><TableCell colSpan={8} className="h-24 text-center">Nenhum pedido para hoje encontrado.</TableCell></TableRow> 
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
                                    <TableCell className="text-right">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => openOrderDetailsDialog(order)}
                                        >
                                            <Eye className="h-3 w-3 mr-1" /> Detalhes
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
                                <p className="text-base">{new Date(selectedOrderDetails.created_at).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Data de Entrega:</Label>
                                <p className="text-base">{formatDeliveryDate(selectedOrderDetails.delivery_date)}</p>
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
