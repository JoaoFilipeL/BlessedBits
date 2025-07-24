import type React from "react"
import UserAppHeader from "../user-app/user-app-header"
import { Sidebar } from "../user-app/user-app-sidebar"


interface DashboardAppProps {
    children: React.ReactNode
}

export function DashboardApp({ children }: DashboardAppProps) {
    return (
        <>
            <div className="md:block">
                <UserAppHeader />
                <div className="border-t">
                    <div className="bg-background">
                        <div className="grid md:grid-cols-5">
                            <Sidebar className='lg:block' />
                            <div className="col-span-3 lg:col-span-4 lg:border-l">
                                <div className="h-full px-4 py-6 lg:px-8">
                                    {children}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}