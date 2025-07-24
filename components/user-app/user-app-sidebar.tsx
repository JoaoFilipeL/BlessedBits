import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ClipboardList, Landmark, Menu, PackageSearch } from "lucide-react";
import Link from 'next/link';


interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
    className?: string;
}


export function Sidebar({ className }: SidebarProps) {
    return (
        <div className={cn("pb-12", className)}>
            <div className="space-y-4 py-4">
                <div className="px-3 py-2">
                    <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">
                        Descubra
                    </h2>
                    <div className="space-y-1">
                        <Button asChild variant="ghost" className="w-full justify-start">
                            <Link href="/dashboard">
                                <Menu className="mr-2 h-4 w-4" />
                                Dashboard
                            </Link>
                        </Button>
                        <Button asChild variant="ghost" className="w-full justify-start">
                            <Link href="/orders">
                                <ClipboardList className="mr-2 h-4 w-4" />
                                Pedidos
                            </Link>
                        </Button>
                        <Button asChild variant="ghost" className="w-full justify-start">
                            <Link href="/stock">
                                <PackageSearch className="mr-2 h-4 w-4" />
                                Estoque
                            </Link>
                        </Button>
                        <Button asChild variant="ghost" className="w-full justify-start">
                            <Link href="/finance">
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
