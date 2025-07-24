import { DashboardApp } from "@/components/dashboard/dashboard-app"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { StockTable } from "@/components/stock/stock-table"
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'; 
import { cookies } from 'next/headers'; 
import { redirect, RedirectType } from 'next/navigation'; 

export default async function StockPage() {
  let loggedIn = false;
  try {
    const supabase = createServerComponentClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (session) loggedIn = true;

  } catch (error) {
    console.error('Error in StockPage component:', error);
  } finally {
    if (!loggedIn) redirect('/', RedirectType.replace); 
  }

  return (
    <DashboardApp>
      <DashboardHeader heading="Controle de Estoque" text="Gerencie o estoque de ingredientes e produtos." />
      <div className="grid gap-8">
        <StockTable />
      </div>
    </DashboardApp>
  )
}
