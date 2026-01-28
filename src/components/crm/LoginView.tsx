import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n'
import { toast } from 'sonner'
import { CircleNotch, CheckCircle } from '@phosphor-icons/react'

interface LoginViewProps {
  onLogin: (email: string, password: string) => Promise<void>
  onSwitchToRegister?: () => void
  onForgotPassword?: (email: string) => Promise<void>
}

function LoginView({ onLogin, onSwitchToRegister, onForgotPassword }: LoginViewProps) {
  const t = useTranslation('es')
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isResetting, setIsResetting] = useState(false) // Toggle mode
  const [isSuccess, setIsSuccess] = useState(false) // Success mode
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email || (!isResetting && !password)) {
      toast.error(t.messages.fillRequired)
      return
    }

    setIsLoading(true)
    setErrorMessage(null)

    try {
      if (isResetting) {
        if (onForgotPassword) {
          await onForgotPassword(email)
          setIsSuccess(true)
        }
      } else {
        await onLogin(email, password)
        navigate('/dashboard')
      }
    } catch (error: any) {
      console.error('Login/Reset error:', error)
      setErrorMessage(error.message || 'Ha ocurrido un error. Inténtalo de nuevo.')
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

  if (isResetting && isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md animate-in fade-in zoom-in duration-300">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto bg-green-100 dark:bg-green-900/30 w-16 h-16 rounded-full flex items-center justify-center mb-4 text-green-600 dark:text-green-400">
              <CheckCircle size={32} weight="fill" />
            </div>
            <CardTitle className="text-2xl font-bold text-green-600 dark:text-green-500">¡Correo Enviado!</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-6">
            <p className="text-muted-foreground text-lg">
              Hemos enviado un enlace de recuperación a <br />
              <strong className="text-foreground">{email}</strong>
            </p>
            <p className="text-sm text-muted-foreground">
              Revisa tu bandeja de entrada (y la carpeta de spam) para continuar con el proceso.
            </p>
            <Button
              className="w-full"
              size="lg"
              onClick={() => {
                setIsSuccess(false)
                setIsResetting(false)
                setPassword('')
              }}
            >
              Volver a Iniciar Sesión
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md animate-in fade-in zoom-in-95 slide-in-from-bottom-8 duration-500">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-primary animate-in fade-in slide-in-from-top-4 duration-700 delay-150">CRM Pro</CardTitle>
          <CardDescription className="text-lg mt-2 animate-in fade-in duration-700 delay-200">
            {isResetting ? 'Recuperar Contraseña' : t.auth.welcome}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div key={isResetting ? 'reset' : 'login'} className="animate-in fade-in slide-in-from-right-4 duration-300">
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

              {!isResetting && (
                <div className="animate-in fade-in slide-in-from-left-2 duration-300 delay-75">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="login-password">{t.auth.password}</Label>
                    <button
                      type="button"
                      onClick={() => setIsResetting(true)}
                      className="text-xs text-primary hover:underline font-medium"
                      tabIndex={-1}
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                  <Input
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    className="mt-1"
                  />
                </div>
              )}

              <Button type="submit" className="w-full transition-all duration-300 hover:scale-[1.02]" size="lg" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <CircleNotch size={20} className="animate-spin mr-2" />
                    {isResetting ? 'Enviando enlace...' : 'Iniciando sesión...'}
                  </>
                ) : (
                  isResetting ? 'Enviar enlace de recuperación' : t.auth.login
                )}
              </Button>

              {errorMessage && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-md text-center animate-in fade-in slide-in-from-top-2">
                  {errorMessage}
                </div>
              )}

              <div className="text-center mt-4 space-y-2">
                {isResetting ? (
                  <button
                    type="button"
                    onClick={() => setIsResetting(false)}
                    className="text-sm text-muted-foreground hover:text-foreground hover:underline transition-colors"
                  >
                    Volver a Iniciar Sesión
                  </button>
                ) : (
                  <Link
                    to="/register"
                    onClick={(e) => {
                      if (onSwitchToRegister) {
                        e.preventDefault()
                        onSwitchToRegister()
                      }
                    }}
                    className="text-sm text-primary hover:underline block hover:scale-105 transition-transform duration-200"
                  >
                    {t.auth.createAccount}
                  </Link>
                )}
              </div>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default LoginView
