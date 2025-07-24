'use client'

import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useState } from 'react'; // Importar useState para controlar a visibilidade da senha

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react'; // Importar ícones de olho

const formSchema = z.object({
    email: z
        .string()
        .min(1, { message: 'Email é obrigatório' }) // Mensagem para campo vazio
        .email('Email inválido'), // Mensagem para formato de email inválido
    password: z
        .string()
        .min(1, { message: 'Senha é obrigatória' }) // Mensagem para campo vazio
        .min(6, {
            message: 'Senha deve ter pelo menos 6 caracteres',
        })
        .max(12, {
            message: 'Senha deve ter no máximo 12 caracteres', // Mensagem para senha muito longa
        }),
})

export function LoginAccountForm() {
    const router = useRouter();
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            email: '',
            password: '',
        },
    });

    const [showPassword, setShowPassword] = useState(false);
    const [loginError, setLoginError] = useState<string | null>(null); // Novo estado para a mensagem de erro de login

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        setLoginError(null); // Limpa erros anteriores
        try {
            const supabase = createClientComponentClient();
            const { email, password } = values;
            const { error, data: { session }} = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                console.error('Erro ao fazer login:', error.message);
                // Mapeia mensagens de erro específicas do Supabase para mensagens amigáveis
                if (error.message.includes('Invalid login credentials') || error.message.includes('Email not confirmed')) {
                    setLoginError('Credenciais inválidas. Verifique seu e-mail e senha.');
                } else if (error.message.includes('User not found')) { // Embora 'Invalid login credentials' já cubra isso
                    setLoginError('E-mail não cadastrado.');
                } else {
                    setLoginError('Ocorreu um erro ao fazer login. Tente novamente.');
                }
            } else if (session) {
                form.reset();
                router.refresh();
            } else {
                setLoginError('Login falhou. Verifique suas credenciais.');
            }

        } catch (error: any) {
            console.error('Erro inesperado ao fazer login:', error);
            setLoginError(error.message || 'Ocorreu um erro inesperado. Tente novamente.');
        }
    };

    return (
        <div className='flex flex-col justify-center items-center space-y-2'>
            <Form {...form}>
                <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className='flex flex-col space-y-4 w-full'
                >
                    {loginError && ( // Exibe a mensagem de erro se houver
                        <div className="text-red-500 text-sm text-center">
                            {loginError}
                        </div>
                    )}
                    <FormField
                        control={form.control}
                        name='email'
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>E-mail</FormLabel>
                                <FormControl>
                                    <Input
                                        placeholder='Digite seu e-mail'
                                        {...field}
                                        type='email'
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name='password'
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Senha</FormLabel>
                                <FormControl>
                                    <div className="relative">
                                        <Input
                                            placeholder='Digite sua senha'
                                            {...field}
                                            type={showPassword ? 'text' : 'password'}
                                            className="pr-10"
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="absolute right-0 top-0 h-full px-3 py-1"
                                            onClick={() => setShowPassword((prev) => !prev)}
                                        >
                                            {showPassword ? (
                                                <EyeOff className="h-4 w-4" />
                                            ) : (
                                                <Eye className="h-4 w-4" />
                                            )}
                                        </Button>
                                    </div>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <Button type='submit' className='w-full mt-4'>Entrar</Button>
                </form>
            </Form>
        </div>
    )
}
