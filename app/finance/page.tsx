import { DashboardApp } from "@/components/dashboard/dashboard-app"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { FinancialSummary } from "@/components/finance/finance-summary"
import { FinancialTransactions } from "@/components/finance/finance-transactions"
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'; 
import { cookies } from 'next/headers'; 
import { redirect, RedirectType } from 'next/navigation'; 

export default async function FinancesPage() {
  let loggedIn = false;
  try {
    const supabase = createServerComponentClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (session) loggedIn = true;

  } catch (error) {
    console.error('Error in FinancesPage component:', error);
  } finally {
    if (!loggedIn) redirect('/', RedirectType.replace); 
  }

  return (
    <DashboardApp>
      <DashboardHeader heading="Gestão Financeira" text="Acompanhe as finanças da sua loja." />
      <div className="grid gap-8">
        <FinancialSummary />
        <FinancialTransactions />
      </div>
    </DashboardApp>
  )
}
