    import { DashboardApp } from '@/components/dashboard/dashboard-app';
    import { DashboardHeader } from '@/components/dashboard/dashboard-header'; 
    import { CustomersList } from '@/components/customers/customers-list'; 
    import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
    import { cookies } from 'next/headers';
    import { redirect, RedirectType } from 'next/navigation';

    export default async function CustomersPage() { 
      let loggedIn = false;
      try {
        const supabase = createServerComponentClient({ cookies });
        const { data: { session } } = await supabase.auth.getSession();

        if (session) loggedIn = true;

      } catch (error) {
        console.error('Error in Customers component:', error);
      } finally {
        if (!loggedIn) redirect('/', RedirectType.replace);
      }

      return (
        <DashboardApp>
          <DashboardHeader heading="Clientes" text="Gerencie os clientes da sua loja." />
          <div className="p-4 md:p-6 lg:p-8"> 
            <CustomersList /> 
          </div>
        </DashboardApp>
      )
    }
    