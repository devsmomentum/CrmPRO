import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n'
import { toast } from 'sonner'

interface RegisterViewProps {
  onRegister: (email: string, password: string, businessName: string) => void
  onSwitchToLogin: () => void
}

export function RegisterView({ onRegister, onSwitchToLogin }: RegisterViewProps) {
  const t = useTranslation('es')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [businessName, setBusinessName] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email || !password || !confirmPassword || !businessName) {
      toast.error(t.messages.fillRequired)
      return
    }

    if (password !== confirmPassword) {
      toast.error('Las contraseñas no coinciden')
      return
    }

    if (password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres')
      return
    }

    onRegister(email, password, businessName)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-primary">CRM Pro</CardTitle>
          <CardDescription className="text-lg mt-2">{t.auth.createAccount}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="register-business">Nombre</Label>
              <Input
                id="register-business"
                value={businessName}
                onChange={(e) => {
                  if (e.target.value.length <= 30) setBusinessName(e.target.value)
                }}
                placeholder="Nombre de la empresa"
              />
            </div>
            <div>
              <Label htmlFor="register-email">{t.auth.email}</Label>
              <Input
                id="register-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@empresa.com"
              />
            </div>
            <div>
              <Label htmlFor="register-password">{t.auth.password}</Label>
              <Input
                id="register-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div>
              <Label htmlFor="register-confirm-password">{t.auth.confirmPassword}</Label>
              <Input
                id="register-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <Button type="submit" className="w-full" size="lg">
              {t.auth.register}
            </Button>
            <div className="text-center mt-4">
              <button
                type="button"
                onClick={onSwitchToLogin}
                className="text-sm text-primary hover:underline"
              >
                {t.auth.login}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
