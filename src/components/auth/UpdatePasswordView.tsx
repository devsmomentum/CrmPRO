import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Eye, EyeSlash } from '@phosphor-icons/react'

export function UpdatePasswordView() {
    const navigate = useNavigate()
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)

    useEffect(() => {
        // Verificar si hay sesión (Supabase loguea automáticamente al hacer clic en el link de recuperación)
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) {
                toast.error('El enlace ha expirado o es inválido.')
                navigate('/login')
            }
        })
    }, [navigate])

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault()

        if (password.length < 6) {
            toast.error('La contraseña debe tener al menos 6 caracteres')
            return
        }

        if (password !== confirmPassword) {
            toast.error('Las contraseñas no coinciden')
            return
        }

        setLoading(true)
        try {
            const { error } = await supabase.auth.updateUser({
                password: password
            })

            if (error) throw error

            toast.success('¡Contraseña actualizada correctamente!')
            navigate('/dashboard')
        } catch (error: any) {
            console.error('Error updating password:', error)
            toast.error(error.message || 'Error al actualizar contraseña')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-300">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl font-bold animate-in fade-in slide-in-from-top-2 duration-300 delay-75">Nueva Contraseña</CardTitle>
                    <CardDescription className="animate-in fade-in duration-300 delay-100">
                        Introduce tu nueva contraseña para recuperar el acceso a tu cuenta.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleUpdate} className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300 delay-75">
                        <div className="space-y-2">
                            <Label htmlFor="password">Nueva Contraseña</Label>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Mínimo 6 caracteres"
                                    disabled={loading}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showPassword ? <EyeSlash size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="confirm-password">Confirmar Contraseña</Label>
                            <Input
                                id="confirm-password"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Repite la contraseña"
                                disabled={loading}
                            />
                        </div>

                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? 'Actualizando...' : 'Actualizar Contraseña'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
