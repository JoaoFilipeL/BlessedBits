import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ClipboardList, Landmark, Menu, PackageSearch, Users, X } from "lucide-react"; 
import Link from 'next/link';

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
    className?: string;
    isSidebarOpen: boolean;
    toggleSidebar: () => void;
}

export function Sidebar({ className, isSidebarOpen, toggleSidebar }: SidebarProps) {
    return (
        <div className={cn("pb-12", className)}>
            <div className="space-y-4 py-4">
                <div className="px-3 py-2">
                    <div className="flex items-center justify-between lg:justify-start mb-2 px-4"> 
                        <h2 className="text-lg font-semibold tracking-tight">
                            Descubra
                        </h2>

                        <Button
                            variant="ghost"
                            size="icon"
                            className="lg:hidden" 
                            onClick={toggleSidebar}
                            aria-label="Close sidebar"
                        >
                            <X className="h-6 w-6" />
                        </Button>
                    </div>
                    <div className="space-y-1">
                        <Button asChild variant="ghost" className="w-full justify-start">
                            <Link href="/dashboard" onClick={toggleSidebar}> 
                                <Menu className="mr-2 h-4 w-4" />
                                Dashboard
                            </Link>
                        </Button>
                        <Button asChild variant="ghost" className="w-full justify-start">
                            <Link href="/orders" onClick={toggleSidebar}>
                                <ClipboardList className="mr-2 h-4 w-4" />
                                Pedidos
                            </Link>
                        </Button>
                        <Button asChild variant="ghost" className="w-full justify-start">
                            <Link href="/customers" onClick={toggleSidebar}>
                                <Users className="mr-2 h-4 w-4" />
                                Clientes
                            </Link>
                        </Button>
                        <Button asChild variant="ghost" className="w-full justify-start">
                            <Link href="/stock" onClick={toggleSidebar}>
                                <PackageSearch className="mr-2 h-4 w-4" />
                                Estoque
                            </Link>
                        </Button>
                        <Button asChild variant="ghost" className="w-full justify-start">
                            <Link href="/finance" onClick={toggleSidebar}>
                                <Landmark className="mr-2 h-4 w-4" />
                                Finanças
                            </Link>
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
