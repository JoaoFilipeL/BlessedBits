"use client"
import type React from "react"
import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { User as SupabaseUser } from "@supabase/auth-helpers-nextjs"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Camera, Trash2 } from "lucide-react"
import Cropper from 'react-easy-crop'
import { Area } from 'react-easy-crop'

interface UserProfile {
    name: string;
    email: string;
    phone: string | null;
    bio: string | null;
    avatar_url: string | null;
}

const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
        const image = new Image()
        image.addEventListener('load', () => resolve(image))
        image.addEventListener('error', (error) => reject(error))
        image.setAttribute('crossOrigin', 'anonymous')
        image.src = url
    })

function getRadianAngle(degreeValue: number) {
    return (degreeValue * Math.PI) / 180
}

function rotateSize(width: number, height: number, rotation: number) {
    const rotRad = getRadianAngle(rotation)
    return {
        width:
            Math.abs(width * Math.cos(rotRad)) + Math.abs(height * Math.sin(rotRad)),
        height:
            Math.abs(width * Math.sin(rotRad)) + Math.abs(height * Math.cos(rotRad)),
    }
}

async function getCroppedImg(imageSrc: string, pixelCrop: Area, rotation = 0): Promise<Blob | null> {
    const image = await createImage(imageSrc)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    if (!ctx) {
        return null
    }

    const rotRad = getRadianAngle(rotation)

    const { width: imageWidth, height: imageHeight } = image

    const rotatedSize = rotateSize(imageWidth, imageHeight, rotation)
    const { width: rotatedWidth, height: rotatedHeight } = rotatedSize

    canvas.width = rotatedWidth
    canvas.height = rotatedHeight

    ctx.translate(rotatedWidth / 2, rotatedHeight / 2)
    ctx.rotate(rotRad)
    ctx.drawImage(image, -imageWidth / 2, -imageHeight / 2, imageWidth, imageHeight)

    const data = ctx.getImageData(
        pixelCrop.x + (rotatedWidth - imageWidth) / 2,
        pixelCrop.y + (rotatedHeight - imageHeight) / 2,
        pixelCrop.width,
        pixelCrop.height
    )

    canvas.width = pixelCrop.width
    canvas.height = pixelCrop.height


    ctx.putImageData(data, 0, 0)

    return new Promise((resolve) => {
        canvas.toBlob((blob) => {
            resolve(blob)
        }, 'image/jpeg', 0.95) 
    })
}


export function UserNav() {
    const router = useRouter();
    const supabase = createClientComponentClient();

    const [user, setUser] = useState<SupabaseUser | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile>({
        name: "Carregando...",
        email: "carregando@email.com",
        phone: null,
        bio: null,
        avatar_url: null,
    });
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
    const [isRemovingAvatar, setIsRemovingAvatar] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
    const [isCropperOpen, setIsCropperOpen] = useState(false);

    const avatarFileInputRef = useRef<HTMLInputElement>(null);

    const formatPhoneNumber = (value: string) => {
        const numericValue = value.replace(/\D/g, ""); 
        if (numericValue.length <= 3) {
            return numericValue;
        } else if (numericValue.length <= 6) {
            return `(${numericValue.slice(0, 3)}) ${numericValue.slice(3)}`;
        } else if (numericValue.length <= 10) {
            return `(${numericValue.slice(0, 3)}) ${numericValue.slice(3, 6)}-${numericValue.slice(6, 10)}`;
        } else {
            return `(${numericValue.slice(0, 3)}) ${numericValue.slice(3, 6)}-${numericValue.slice(6, 10)}`;
        }
    };

    const handlePhoneInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const formattedValue = formatPhoneNumber(e.target.value);
        setUserProfile((prev: UserProfile) => ({ ...prev, phone: formattedValue }));
    };

    const fetchUserAndProfile = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

            if (authError) {
                console.error('Erro ao buscar usuário autenticado:', authError);
                setError(authError.message);
                setUser(null);
                setUserProfile({ name: "Carregando...", email: "carregando@email.com", phone: null, bio: null, avatar_url: null });
                return;
            }

            setUser(authUser);

            if (authUser) {
                const { data: profileData, error: profileError } = await supabase
                    .from('profiles')
                    .select('name, phone, bio, avatar_url')
                    .eq('id', authUser.id)
                    .single();

                if (profileError && profileError.code !== 'PGRST116') {
                    console.error('Erro ao buscar perfil do usuário:', profileError);
                    setError(profileError.message);
                    setUserProfile({
                        name: authUser.email?.split('@')[0] || "Usuário",
                        email: authUser.email || "N/A",
                        phone: null, bio: null, avatar_url: null
                    });
                } else if (profileData) {
                    setUserProfile({
                        name: profileData.name || authUser.email?.split('@')[0] || "Usuário",
                        email: authUser.email || "N/A",
                        phone: profileData.phone ? formatPhoneNumber(profileData.phone) : null, 
                        bio: profileData.bio,
                        avatar_url: profileData.avatar_url,
                    });
                } else {
                    const defaultProfile = {
                        name: authUser.email?.split('@')[0] || "Usuário",
                        email: authUser.email || "N/A",
                        phone: null,
                        bio: null,
                        avatar_url: null,
                    };
                    setUserProfile(defaultProfile);

                    const { error: insertProfileError } = await supabase
                        .from('profiles')
                        .insert({
                            id: authUser.id,
                            name: defaultProfile.name,
                        });
                    if (insertProfileError) {
                        console.error('Erro ao criar perfil padrão:', insertProfileError);
                        setError(insertProfileError.message);
                    }
                }
            } else {
                setUserProfile({ name: "Convidado", email: "nao_logado@email.com", phone: null, bio: null, avatar_url: null });
            }
        } catch (err: any) {
            console.error('Erro inesperado ao carregar usuário/perfil:', err);
            setError(err.message || "Erro ao carregar informações do usuário.");
        } finally {
            setIsLoading(false);
        }
    }, [supabase]);

    useEffect(() => {
        fetchUserAndProfile();

        const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
                fetchUserAndProfile();
            }
        });

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, [supabase, fetchUserAndProfile]);


    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setUserProfile((prev: UserProfile) => ({ ...prev, [name]: value }));
    };

    const handleSaveProfile = async () => {
        setIsLoading(true);
        setError(null);
        if (!user) {
            setError("Nenhum usuário logado para salvar o perfil.");
            setIsLoading(false);
            return;
        }

        try {
            const { error: updateError } = await supabase
                .from('profiles')
                .update({
                    name: userProfile.name,
                    phone: userProfile.phone ? userProfile.phone.replace(/\D/g, '') : null, 
                    bio: userProfile.bio,
                })
                .eq('id', user.id);

            if (updateError) {
                console.error('Erro ao salvar perfil:', updateError);
                setError(updateError.message);
                return;
            }

            setIsSettingsOpen(false);
            await fetchUserAndProfile(); 
        } catch (err: any) {
            console.error('Erro inesperado ao salvar perfil:', err);
            setError(err.message || "Erro ao salvar alterações.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files.length > 0) {
            const file = event.target.files[0];
            const reader = new FileReader();
            reader.addEventListener('load', () => {
                setImageSrc(reader.result as string);
                setCrop({ x: 0, y: 0 }); 
                setZoom(1);
                setRotation(0);
                setIsCropperOpen(true);
            });
            reader.readAsDataURL(file);
        }
    };

    const triggerAvatarUpload = () => {
        avatarFileInputRef.current?.click();
    };

    const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const handleSaveCroppedAvatar = async () => {
        if (!user || !imageSrc || !croppedAreaPixels) {
            setError("Erro: Imagem ou área de corte não definida.");
            return;
        }

        setIsUploadingAvatar(true);
        setError(null);

        try {
            console.log('Iniciando getCroppedImg...');
            const croppedImageBlob = await getCroppedImg(imageSrc, croppedAreaPixels, rotation);
            console.log('Cropped Blob:', croppedImageBlob);
            console.log('Cropped Blob Type:', croppedImageBlob?.type);
            console.log('Cropped Blob Size:', croppedImageBlob?.size);


            if (!croppedImageBlob) {
                setError("Não foi possível obter a imagem cortada.");
                setIsUploadingAvatar(false);
                return;
            }

            let fileExt = croppedImageBlob.type.split('/')[1];
            if (fileExt === 'jpeg') fileExt = 'jpg'; 

            const fileName = `${user.id}.${fileExt}`;
            const filePath = fileName;

            console.log('Tentando upload para Supabase Storage:', { filePath, fileType: croppedImageBlob.type });
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, croppedImageBlob, {
                    upsert: true,
                    contentType: croppedImageBlob.type,
                });

            if (uploadError) {
                console.error('Erro ao fazer upload do avatar:', uploadError);
                setError(`Erro de upload: ${uploadError.message}. Verifique as políticas de RLS do Storage.`);
                setIsUploadingAvatar(false);
                return;
            }
            console.log('Upload bem-sucedido. Obtendo URL pública...');

            const timestamp = new Date().getTime();
            const publicUrl = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath).data?.publicUrl;

            const finalAvatarUrl = publicUrl ? `${publicUrl}?t=${timestamp}` : null;


            if (finalAvatarUrl) {
                console.log('URL pública obtida:', finalAvatarUrl);
                console.log('Atualizando perfil com nova URL do avatar...');
                const { error: updateProfileError } = await supabase
                    .from('profiles')
                    .update({ avatar_url: finalAvatarUrl }) 
                    .eq('id', user.id);

                if (updateProfileError) {
                    console.error('Erro ao salvar URL do avatar no perfil:', updateProfileError);
                    setError(`Erro ao salvar URL no perfil: ${updateProfileError.message}. Verifique as políticas de RLS da tabela 'profiles'.`);
                    setIsUploadingAvatar(false);
                    return;
                }
                console.log('Perfil atualizado com nova URL do avatar.');

                setUserProfile((prev: UserProfile) => ({ ...prev, avatar_url: finalAvatarUrl }));
                setIsCropperOpen(false);
                setImageSrc(null);
            } else {
                setError("Não foi possível obter a URL pública do avatar.");
            }
        } catch (err: any) {
            console.error('Erro inesperado ao fazer upload do avatar:', err);
            setError(err.message || "Erro ao fazer upload do avatar.");
        } finally {
            setIsUploadingAvatar(false);
        }
    };

    const handleRemoveAvatar = async () => {
        if (!user || !userProfile.avatar_url) {
            setError("Nenhum avatar para remover ou usuário não logado.");
            return;
        }

        setIsRemovingAvatar(true);
        setError(null);

        try {
            const urlWithoutCacheBusting = userProfile.avatar_url.split('?')[0];
            const urlParts = urlWithoutCacheBusting.split('/');
            const fileName = urlParts[urlParts.length - 1];

            const { error: deleteError } = await supabase.storage
                .from('avatars')
                .remove([fileName]);

            if (deleteError) {
                console.error('Erro ao remover avatar do Storage:', deleteError);
                setError(`Erro ao remover avatar: ${deleteError.message}. Verifique as políticas de RLS do Storage.`);
                return;
            }

            const { error: updateProfileError } = await supabase
                .from('profiles')
                .update({ avatar_url: null })
                .eq('id', user.id);

            if (updateProfileError) {
                console.error('Erro ao limpar URL do avatar no perfil:', updateProfileError);
                setError(`Erro ao limpar URL do perfil: ${updateProfileError.message}.`);
                return;
            }

            setUserProfile((prev: UserProfile) => ({ ...prev, avatar_url: null }));
            setIsSettingsOpen(false);
        } catch (err: any) {
            console.error('Erro inesperado ao remover avatar:', err);
            setError(err.message || "Erro ao remover avatar.");
        } finally {
            setIsRemovingAvatar(false);
        }
    };


    const handleSignOut = async () => {
        setIsLoading(true);
        try {
            const { error } = await supabase.auth.signOut();
            if (error) {
                console.error('Erro ao fazer logout:', error);
                setError(error.message);
                setIsLoading(false);
                return;
            }
            router.refresh();
        } catch (err: any) {
            console.error('Erro inesperado ao fazer logout:', err);
            setError(err.message || "Erro ao fazer logout.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            {user && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={userProfile.avatar_url || "https://placehold.co/32x32/e0e0e0/000000?text=AD"} alt="Avatar" />
                                <AvatarFallback>{userProfile.name ? userProfile.name.charAt(0).toUpperCase() : (user?.email ? user.email.charAt(0).toUpperCase() : 'AD')}</AvatarFallback>
                            </Avatar>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56" align="end" forceMount>
                        <DropdownMenuLabel className="font-normal">
                            <div className="flex flex-col space-y-1">
                                <p className="text-sm font-medium leading-none">{userProfile.name}</p>
                                <p className="text-xs leading-none text-muted-foreground">{userProfile.email}</p>
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                            <DropdownMenuItem onClick={() => setIsSettingsOpen(true)}>
                                Perfil
                            </DropdownMenuItem>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleSignOut} disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Sair
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            )}

            <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                <DialogContent className="sm:max-w-[525px]">
                    <DialogHeader>
                        <DialogTitle>Configurações de Perfil</DialogTitle>
                        <DialogDescription>Gerencie suas informações de perfil.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {isLoading && !userProfile.name ? (
                            <div className="text-center py-8">
                                <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                                <p className="text-sm text-muted-foreground mt-2">Carregando perfil...</p>
                            </div>
                        ) : error ? (
                            <div className="text-center text-red-500 py-8">{error}</div>
                        ) : (
                            <>
                                <div className="flex items-center gap-4">
                                    <div className="relative group">
                                        <Avatar className="h-16 w-16">
                                            <AvatarImage src={userProfile.avatar_url || "https://placehold.co/64x64/e0e0e0/000000?text=AD"} alt="Avatar" />
                                            <AvatarFallback>{userProfile.name ? userProfile.name.charAt(0).toUpperCase() : (user?.email ? user.email.charAt(0).toUpperCase() : 'AD')}</AvatarFallback>
                                        </Avatar>
                                        <div
                                            className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
                                            onClick={triggerAvatarUpload}
                                        >
                                            {isUploadingAvatar ? (
                                                <Loader2 className="h-6 w-6 animate-spin text-white" />
                                            ) : (
                                                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full text-white">
                                                    <Camera className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                        <input
                                            type="file"
                                            ref={avatarFileInputRef}
                                            onChange={handleFileChange}
                                            className="hidden"
                                            accept="image/*"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-medium">Foto de Perfil</h3>
                                        <p className="text-sm text-muted-foreground">Clique na imagem para alterar sua foto de perfil.</p>
                                    </div>
                                    {userProfile.avatar_url && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-red-500 hover:text-red-600"
                                            onClick={handleRemoveAvatar}
                                            disabled={isRemovingAvatar}
                                        >
                                            {isRemovingAvatar ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Trash2 className="h-4 w-4" />
                                            )}
                                        </Button>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="name">Nome</Label>
                                    <Input id="name" name="name" value={userProfile.name} onChange={handleInputChange} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="email">Email</Label>
                                    <Input
                                        id="email"
                                        name="email"
                                        type="email"
                                        value={userProfile.email}
                                        disabled
                                        className="cursor-not-allowed bg-gray-100 dark:bg-gray-800"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="phone">Telefone</Label>
                                    <Input
                                        id="phone"
                                        name="phone"
                                        value={userProfile.phone || ''}
                                        onChange={handlePhoneInputChange}
                                        placeholder="(000) 000-0000" 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="bio">Biografia</Label>
                                    <Textarea id="bio" name="bio" rows={3} value={userProfile.bio || ''} onChange={handleInputChange} />
                                </div>
                            </>
                        )}
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                        <Button variant="outline" onClick={() => setIsSettingsOpen(false)} disabled={isLoading || isUploadingAvatar || isRemovingAvatar}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSaveProfile} disabled={isLoading || isUploadingAvatar || isRemovingAvatar}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Salvar Alterações
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isCropperOpen} onOpenChange={setIsCropperOpen}>
                <DialogContent className="sm:max-w-[600px] h-[500px] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Cortar Imagem de Perfil</DialogTitle>
                        <DialogDescription>Ajuste a imagem para o seu avatar.</DialogDescription>
                    </DialogHeader>
                    <div className="relative flex-grow min-h-0">
                        {imageSrc && (
                            <Cropper
                                image={imageSrc}
                                crop={crop}
                                zoom={zoom}
                                rotation={rotation}
                                aspect={1}
                                onCropChange={setCrop}
                                onZoomChange={setZoom}
                                onRotationChange={setRotation}
                                onCropComplete={onCropComplete}
                                showGrid={true}
                                restrictPosition={false}
                                cropShape="round"
                            />
                        )}
                    </div>
                    <div className="flex flex-col gap-2 pt-4">
                        <Label htmlFor="zoom-range">Zoom</Label>
                        <Input
                            id="zoom-range"
                            type="range"
                            value={zoom}
                            min={1}
                            max={3}
                            step={0.1}
                            aria-labelledby="Zoom"
                            onChange={(e) => setZoom(parseFloat(e.target.value))}
                            className="w-full"
                        />
                         <Label htmlFor="rotation-range">Rotação</Label>
                        <Input
                            id="rotation-range"
                            type="range"
                            value={rotation}
                            min={0}
                            max={360}
                            step={1}
                            aria-labelledby="Rotation"
                            onChange={(e) => setRotation(parseFloat(e.target.value))}
                            className="w-full"
                        />
                    </div>
                    <DialogFooter className="mt-4">
                        <Button variant="outline" onClick={() => setIsCropperOpen(false)} disabled={isUploadingAvatar}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSaveCroppedAvatar} disabled={isUploadingAvatar}>
                            {isUploadingAvatar && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Salvar Avatar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
