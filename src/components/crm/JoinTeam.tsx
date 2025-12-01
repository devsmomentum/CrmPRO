import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { acceptInvitation } from '@/supabase/services/invitations'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

interface JoinTeamProps {
  token: string
  user: any
  onSuccess: () => void
  onLoginRequest: () => void
}

export function JoinTeam({ token, user, onSuccess, onLoginRequest }: JoinTeamProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user && token) {
      handleAccept()
    }
  }, [user, token])

  const handleAccept = async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      await acceptInvitation(token, user.id)
      toast.success('¡Te has unido al equipo exitosamente!')
      onSuccess()
    } catch (err: any) {
      console.error('Error accepting invitation:', err)
      setError(err.message || 'Error al aceptar la invitación')
      toast.error('Error al aceptar la invitación')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-gray-500">Procesando invitación...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Invitación a Equipo</CardTitle>
          <CardDescription>
            Has sido invitado a unirte a un equipo en el CRM.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <div className="p-3 bg-red-50 text-red-600 rounded-md text-sm">
              {error}
            </div>
          ) : (
            <>
              {!user ? (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">
                    Para aceptar la invitación, necesitas iniciar sesión o crear una cuenta.
                  </p>
                  <Button className="w-full" onClick={onLoginRequest}>
                    Iniciar Sesión / Registrarse
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                   <p className="text-sm text-gray-600">
                    Aceptando invitación como <strong>{user.email}</strong>...
                  </p>
                  <Button className="w-full" onClick={handleAccept} disabled={loading}>
                    {loading ? 'Procesando...' : 'Aceptar Invitación'}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
