import { DashboardApp } from '@/components/dashboard/dashboard-app';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { DashboardStats } from '@/components/dashboard/dashboard-stats';
import { OrdersTable } from '@/components/orders/orders-table';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect, RedirectType } from 'next/navigation';

export default async function Dashboard() {
  let loggedIn = false;
  try {
    const supabase = createServerComponentClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (session) loggedIn = true;

  } catch (error) {
    console.error('Error in Dashboard component:', error);
  } finally {
    if (!loggedIn) redirect('/', RedirectType.replace);
  }

  return (
    <DashboardApp>
      <DashboardHeader heading="Dashboard" text="Gerencie seus pedidos e acompanhe o desempenho da sua loja." />
      <DashboardStats />
      <div className="mt-6">
        <OrdersTable />
      </div>
    </DashboardApp>
  )
}
