import type React from "react"
interface DashboardHeaderProps {
    heading: string
    text?: string
    children?: React.ReactNode
}

export function DashboardHeader({ heading, text, children }: DashboardHeaderProps) {
    return (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-2 sm:px-4 md:px-6 mb-6">
            <div className="grid gap-1">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{heading}</h1>
                {text && <p className="text-sm md:text-base text-muted-foreground">{text}</p>} 
            </div>
            {children}
        </div>
    )
}
