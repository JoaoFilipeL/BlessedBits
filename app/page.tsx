import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect, RedirectType } from 'next/navigation';
import { LoginAccountForm } from '@/components/auth/login-account-form';

export default async function Home() {
  let loggedIn = false;
  try {
    const supabase = createServerComponentClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (session) loggedIn = true;

  } catch (error) {
    console.error('Error in Home component:', error);
  } finally {
    if (loggedIn) redirect('/dashboard', RedirectType.replace);
  }

  return (
    <div className='flex flex-col h-screen w-full justify-center items-center p-4'>
      <h1 className="text-4xl sm:text-5xl font-bold mb-4 text-center">Bem-vindo ao</h1> 
      <h1 className="text-4xl sm:text-5xl font-bold mb-8 text-center">BlessedBits</h1> 
      <div className='w-full max-w-md border rounded-md pb-4 shadow-2xl p-6'> 
        <LoginAccountForm />
      </div>
    </div>
  )
}
