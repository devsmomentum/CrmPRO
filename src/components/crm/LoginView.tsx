import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n'
import { toast } from 'sonner'

interface LoginViewProps {
  onLogin: (email: string, password: string) => void
  onSwitchToRegister: () => void
}

function LoginView({ onLogin, onSwitchToRegister }: LoginViewProps) {
  const t = useTranslation('es')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!email || !password) {
      toast.error(t.messages.fillRequired)
      return
    }

    onLogin(email, password)
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
              />
            </div>

            <div>
              <Label htmlFor="login-password">{t.auth.password}</Label>
              <Input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <Button type="submit" className="w-full" size="lg">
              {t.auth.login}
            </Button>

            <div className="text-center mt-4">
              <button
                type="button"
                onClick={onSwitchToRegister}
                className="text-sm text-primary hover:underline"
              >
                {t.auth.createAccount}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default LoginView
