import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n'
import { toast } from 'sonner'

interface LoginViewProps {
  onLogin: (email: string, password: string) => Promise<void>
  onSwitchToRegister?: () => void
}

function LoginView({ onLogin, onSwitchToRegister }: LoginViewProps) {
  const t = useTranslation('es')
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email || !password) {
      toast.error(t.messages.fillRequired)
      return
    }

    setIsLoading(true)
    try {
      await onLogin(email, password)
      navigate('/dashboard')
    } catch (error) {
      // Error ya manejado en useAuth
    } finally {
      setIsLoading(false)
    }
  }

  const handleSwitchToRegister = () => {
    if (onSwitchToRegister) {
      onSwitchToRegister()
    } else {
      navigate('/register')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-primary">CRM Pro</CardTitle>
          <CardDescription className="text-lg mt-2">{t.auth.welcome}</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="login-email">{t.auth.email}</Label>
              <Input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@empresa.com"
                disabled={isLoading}
              />
            </div>

            <div>
              <Label htmlFor="login-password">{t.auth.password}</Label>
              <Input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
              {isLoading ? 'Iniciando sesión...' : t.auth.login}
            </Button>

            <div className="text-center mt-4">
              <Link
                to="/register"
                onClick={(e) => {
                  if (onSwitchToRegister) {
                    e.preventDefault()
                    onSwitchToRegister()
                  }
                }}
                className="text-sm text-primary hover:underline"
              >
                {t.auth.createAccount}
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default LoginView
