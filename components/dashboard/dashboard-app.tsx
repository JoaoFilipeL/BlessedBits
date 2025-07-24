"use client" 
import type React from "react"
import { useState } from "react"
import UserAppHeader from "../user-app/user-app-header"
import { Sidebar } from "../user-app/user-app-sidebar"
import { Button } from "@/components/ui/button" 
import { Menu } from "lucide-react"


interface DashboardAppProps {
    children: React.ReactNode
}

export function DashboardApp({ children }: DashboardAppProps) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const toggleSidebar = () => {
        setIsSidebarOpen(!isSidebarOpen);
    };

    return (
        <>
            <div className="flex flex-col h-screen">
                <UserAppHeader /> 
                
                <div className="flex flex-1 border-t overflow-hidden">
                    <Sidebar
                        className={`
                            transform transition-transform duration-300 ease-in-out
                            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                            lg:translate-x-0
                            fixed inset-y-0 left-0 z-40 w-64 bg-background border-r
                            lg:static lg:block lg:w-48 lg:border-r 
                        `}
                        isSidebarOpen={isSidebarOpen}
                        toggleSidebar={toggleSidebar}
                    />
                    {isSidebarOpen && (
                        <div
                            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
                            onClick={toggleSidebar}
                        ></div>
                    )}
                    <main className={`
                        flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto
                        ${isSidebarOpen ? 'ml-64 lg:ml-0' : 'ml-0'}
                        transition-all duration-300 ease-in-out
                    `}>
                        <div className="flex items-center gap-4 mb-6 lg:hidden"> 
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={toggleSidebar}
                                aria-label="Toggle sidebar"
                            >
                                <Menu className="h-6 w-6" />
                            </Button>
                        </div>
                        {children}
                    </main>
                </div>
            </div>
        </>
    )
}
