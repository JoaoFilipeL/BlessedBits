"use client"
import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Search, Plus, Trash2, Edit, Eye } from "lucide-react"
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
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';


export interface Customer { 
    id: string;
    name: string;
    phone: string;
    address: string | null;
    notes: string | null;
    created_at: string;
    user_id: string;
}


interface CustomersListProps {
    onCustomerAdded?: (customer: Customer) => void; 
    isModal?: boolean; 
    onCloseModal?: () => void; 
}

export function CustomersList({ onCustomerAdded, isModal, onCloseModal }: CustomersListProps) {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [newName, setNewName] = useState("");
    const [newPhone, setNewPhone] = useState("");
    const [newAddress, setNewAddress] = useState("");
    const [newNotes, setNewNotes] = useState("");
    const [addFormError, setAddFormError] = useState<string | null>(null);

    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
    const [editName, setEditName] = useState("");
    const [editPhone, setEditPhone] = useState("");
    const [editAddress, setEditAddress] = useState("");
    const [editNotes, setEditNotes] = useState("");
    const [editFormError, setEditFormError] = useState<string | null>(null);

    const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
    const [selectedCustomerDetails, setSelectedCustomerDetails] = useState<Customer | null>(null);

    const supabase = createClientComponentClient();

    const getUserId = useCallback(async () => {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
            console.error("Erro ao obter sessão do usuário:", sessionError);
            return null;
        }
        return session?.user?.id || null;
    }, [supabase]);

    const fetchCustomers = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const userId = await getUserId();
            if (!userId) {
                setError("Usuário não autenticado para buscar clientes.");
                setLoading(false);
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
        } finally {
            setLoading(false);
        }
    }, [supabase, getUserId]);

    useEffect(() => {
        fetchCustomers();

        const channel = supabase
            .channel('customers_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'customers' },
                (payload) => {
                    console.log('Mudança em clientes em tempo real!', payload);
                    fetchCustomers();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase, fetchCustomers]);

    const filteredCustomers = customers.filter(
        (customer) =>
            customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            customer.phone.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (customer.address && customer.address.toLowerCase().includes(searchTerm.toLowerCase()))
    );

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

    const handleNewPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setNewPhone(formatPhoneNumberUS(e.target.value));
    };

    const handleEditPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setEditPhone(formatPhoneNumberUS(e.target.value));
    };

    const addNewCustomer = async () => {
        setAddFormError(null);
        if (!newName || !newPhone) {
            setAddFormError("Nome e Telefone são campos obrigatórios.");
            return;
        }

        try {
            const userId = await getUserId();
            if (!userId) {
                setAddFormError("Usuário não autenticado. Por favor, faça login.");
                return;
            }

            const { data, error: insertError } = await supabase
                .from('customers')
                .insert({
                    name: newName,
                    phone: newPhone,
                    address: newAddress || null,
                    notes: newNotes || null,
                    user_id: userId,
                })
                .select() 
                .single();

            if (insertError) throw insertError;

            setNewName("");
            setNewPhone("");
            setNewAddress("");
            setNewNotes("");
            setIsAddDialogOpen(false);
            setAddFormError(null);

            if (onCustomerAdded && data) {
                onCustomerAdded(data as Customer); 
            }
            if (isModal && onCloseModal) { 
                onCloseModal();
            }
        } catch (err: any) {
            console.error("Erro ao adicionar cliente:", err);
            setAddFormError(err.message || "Erro ao adicionar cliente.");
        }
    };

    const openEditDialog = (customer: Customer) => {
        setEditingCustomer(customer);
        setEditName(customer.name);
        setEditPhone(customer.phone);
        setEditAddress(customer.address || "");
        setEditNotes(customer.notes || "");
        setEditFormError(null);
        setIsEditDialogOpen(true);
    };

    const updateCustomer = async () => {
        setEditFormError(null);
        if (!editingCustomer) return;

        if (!editName || !editPhone) {
            setEditFormError("Nome e Telefone são campos obrigatórios.");
            return;
        }

        try {
            const userId = await getUserId();
            if (!userId) {
                setEditFormError("Usuário não autenticado. Por favor, faça login.");
                return;
            }

            const { error: updateError } = await supabase
                .from('customers')
                .update({
                    name: editName,
                    phone: editPhone,
                    address: editAddress || null,
                    notes: editNotes || null,
                })
                .eq('id', editingCustomer.id)
                .eq('user_id', userId); 

            if (updateError) throw updateError;

            setIsEditDialogOpen(false);
            setEditingCustomer(null);
            setEditFormError(null);
        } catch (err: any) {
            console.error("Erro ao atualizar cliente:", err);
            setEditFormError(err.message || "Erro ao atualizar cliente.");
        }
    };

    const handleDeleteCustomer = async (customerId: string) => {
        const confirmDelete = window.confirm("Tem certeza que deseja excluir este cliente? Esta ação é irreversível.");
        if (!confirmDelete) {
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const userId = await getUserId();
            if (!userId) {
                setError("Usuário não autenticado para excluir cliente.");
                setLoading(false);
                return;
            }

            const { error: deleteError } = await supabase
                .from('customers')
                .delete()
                .eq('id', customerId)
                .eq('user_id', userId); 

            if (deleteError) throw deleteError;
        } catch (err: any) {
            console.error("Erro ao excluir cliente:", err);
            setError(err.message || "Erro ao excluir cliente.");
        } finally {
            setLoading(false);
        }
    };

    const openCustomerDetailsDialog = (customer: Customer) => {
        setSelectedCustomerDetails(customer);
        setIsDetailsDialogOpen(true);
    };

    const renderContent = () => (
        <div className="space-y-4">
            {loading && <div className="text-center text-gray-500">Carregando clientes...</div>}
            {error && <div className="text-center text-red-500">Erro: {error}</div>}

            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-semibold">Clientes Cadastrados</h2>
                    <Badge variant="outline" className="ml-2">
                        {customers.length} total
                    </Badge>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
                    <div className="relative w-full sm:w-auto">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Buscar clientes..."
                            className="pl-8 w-full sm:w-[250px]"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="w-full sm:w-auto">
                                <Plus className="mr-2 h-4 w-4" />
                                Novo Cliente
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md w-[90%]">
                            <DialogHeader>
                                <DialogTitle>Adicionar Novo Cliente</DialogTitle>
                                <DialogDescription>Preencha os detalhes do novo cliente.</DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4 overflow-y-auto max-h-[70vh] pr-4">
                                {addFormError && (
                                    <div className="bg-red-100 text-red-700 p-3 rounded-md text-sm">
                                        {addFormError}
                                    </div>
                                )}
                                <div className="space-y-2">
                                    <Label htmlFor="newName">Nome</Label>
                                    <Input
                                        id="newName"
                                        placeholder="Nome completo do cliente"
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="newPhone">Telefone</Label>
                                    <Input
                                        id="newPhone"
                                        placeholder="(000) 000-0000"
                                        value={newPhone}
                                        onChange={handleNewPhoneChange}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="newAddress">Endereço (opcional)</Label>
                                    <Textarea
                                        id="newAddress"
                                        placeholder="Endereço do cliente"
                                        value={newAddress}
                                        onChange={(e) => setNewAddress(e.target.value)}
                                        rows={2}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="newNotes">Observações (opcional)</Label>
                                    <Textarea
                                        id="newNotes"
                                        placeholder="Observações sobre o cliente"
                                        value={newNotes}
                                        onChange={(e) => setNewNotes(e.target.value)}
                                        rows={2}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                                    Cancelar
                                </Button>
                                <Button onClick={addNewCustomer} disabled={!newName || !newPhone}>
                                    Adicionar Cliente
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
                            <TableHead className="w-[150px]">Nome</TableHead>
                            <TableHead className="w-[150px]">Telefone</TableHead>
                            <TableHead className="hidden md:table-cell">Endereço</TableHead>
                            <TableHead className="text-right w-[180px]">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center">
                                    Carregando clientes...
                                </TableCell>
                            </TableRow>
                        ) : error ? (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center text-red-500">
                                    {error}
                                </TableCell>
                            </TableRow>
                        ) : filteredCustomers.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center">
                                    Nenhum cliente encontrado.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredCustomers.map((customer) => (
                                <TableRow key={customer.id}>
                                    <TableCell className="font-medium">{customer.name}</TableCell>
                                    <TableCell>{customer.phone}</TableCell>
                                    <TableCell className="hidden md:table-cell truncate max-w-[250px]" title={customer.address || "N/A"}>
                                        {customer.address || "N/A"}
                                    </TableCell>
                                    <TableCell className="text-right flex items-center justify-end gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => openCustomerDetailsDialog(customer)}
                                        >
                                            <Eye className="h-3 w-3 mr-1" /> Detalhes
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => openEditDialog(customer)}
                                        >
                                            <Edit className="h-3 w-3 mr-1" /> Editar
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDeleteCustomer(customer.id)}
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
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="max-w-md w-[90%]">
                    <DialogHeader>
                        <DialogTitle>Editar Cliente</DialogTitle>
                        <DialogDescription>Edite os detalhes do cliente.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4 overflow-y-auto max-h-[70vh] pr-4">
                        {editFormError && (
                            <div className="bg-red-100 text-red-700 p-3 rounded-md text-sm">
                                {editFormError}
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="editName">Nome</Label>
                            <Input
                                id="editName"
                                placeholder="Nome completo do cliente"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="editPhone">Telefone</Label>
                            <Input
                                id="editPhone"
                                placeholder="(000) 000-0000"
                                value={editPhone}
                                onChange={handleEditPhoneChange}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="editAddress">Endereço (opcional)</Label>
                            <Textarea
                                id="editAddress"
                                placeholder="Endereço do cliente"
                                value={editAddress}
                                onChange={(e) => setEditAddress(e.target.value)}
                                rows={2}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="editNotes">Observações (opcional)</Label>
                            <Textarea
                                id="editNotes"
                                placeholder="Observações sobre o cliente"
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
                        <Button onClick={updateCustomer} disabled={!editName || !editPhone}>
                            Salvar Alterações
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
                <DialogContent className="max-w-md w-[90%]">
                    <DialogHeader>
                        <DialogTitle>Detalhes do Cliente</DialogTitle>
                        <DialogDescription>Informações completas sobre o cliente.</DialogDescription>
                    </DialogHeader>
                    {selectedCustomerDetails && (
                        <div className="grid gap-4 py-4 overflow-y-auto max-h-[70vh] pr-4">
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Nome:</Label>
                                <p className="text-base">{selectedCustomerDetails.name}</p>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Telefone:</Label>
                                <p className="text-base">{selectedCustomerDetails.phone}</p>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Endereço:</Label>
                                <p className="text-base">{selectedCustomerDetails.address || "N/A"}</p>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Observações:</Label>
                                <p className="text-base">{selectedCustomerDetails.notes || "Nenhuma observação"}</p>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Cadastrado em:</Label>
                                <p className="text-base">{new Date(selectedCustomerDetails.created_at).toLocaleDateString('pt-BR', {
                                    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                })}</p>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button onClick={() => setIsDetailsDialogOpen(false)}>Fechar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );

    return isModal ? (
        <Dialog open={true} onOpenChange={onCloseModal}>
            <DialogContent className="max-w-md w-[90%]">
                <DialogHeader>
                    <DialogTitle>Adicionar Novo Cliente</DialogTitle>
                    <DialogDescription>Preencha os detalhes do novo cliente.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4 overflow-y-auto max-h-[70vh] pr-4">
                    {addFormError && (
                        <div className="bg-red-100 text-red-700 p-3 rounded-md text-sm">
                            {addFormError}
                        </div>
                    )}
                    <div className="space-y-2">
                        <Label htmlFor="newName">Nome</Label>
                        <Input
                            id="newName"
                            placeholder="Nome completo do cliente"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="newPhone">Telefone</Label>
                        <Input
                            id="newPhone"
                            placeholder="(000) 000-0000"
                            value={newPhone}
                            onChange={handleNewPhoneChange}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="newAddress">Endereço (opcional)</Label>
                        <Textarea
                            id="newAddress"
                            placeholder="Endereço do cliente"
                            value={newAddress}
                            onChange={(e) => setNewAddress(e.target.value)}
                            rows={2}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="newNotes">Observações (opcional)</Label>
                        <Textarea
                            id="newNotes"
                            placeholder="Observações sobre o cliente"
                            value={newNotes}
                            onChange={(e) => setNewNotes(e.target.value)}
                            rows={2}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onCloseModal}>
                        Cancelar
                    </Button>
                    <Button onClick={addNewCustomer} disabled={!newName || !newPhone}>
                        Adicionar Cliente
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    ) : (
        renderContent()
    );
}
