'use client'
import { UserNav } from '@/components/common/user-nav';


export default function UserAppHeader() {
    return (
        <header className='m-1'>
            <nav className='flex justify-between items-center p-4'>
                <span className="font-bold text-xl">BlessedBits</span>
                <UserNav />
            </nav>
        </header>
    );
}