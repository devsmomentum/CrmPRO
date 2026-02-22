import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n'
import { toast } from 'sonner'
import { CircleNotch, CheckCircle, CaretDown, CaretUp, ShieldCheck } from '@phosphor-icons/react'
import { LoadingScreen } from '@/components/ui/LoadingScreen'
import { useAuth } from '@/hooks/useAuth'

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
  const [showMoreOptions, setShowMoreOptions] = useState(false)
  const [recoveryEmail, setRecoveryEmail] = useState('')
  const [isRecoveryLoading, setIsRecoveryLoading] = useState(false)
  const [recoverySuccessMsg, setRecoverySuccessMsg] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const { resetPasswordByRecoveryEmail } = useAuth()

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
      const msg = error.message || 'Ha ocurrido un error. Inténtalo de nuevo.'
      setErrorMessage(msg)
      toast.error(msg)
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

  if (isLoading) {
    return <LoadingScreen />
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
              {recoverySuccessMsg ? recoverySuccessMsg : (
                <>
                  Hemos enviado un enlace de recuperación a <br />
                  <strong className="text-foreground">{email}</strong>
                </>
              )}
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
                setRecoveryEmail('')
                setRecoverySuccessMsg(null)
              }}
            >
              Volver a Iniciar Sesión
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!recoveryEmail) {
      toast.error('Ingresa tu correo alternativo')
      return
    }

    setIsRecoveryLoading(true)
    setErrorMessage(null)

    try {
      await resetPasswordByRecoveryEmail(recoveryEmail)
      setRecoverySuccessMsg(`Enviamos el enlace de recuperación a tu correo alternativo: ${recoveryEmail}`)
      setIsSuccess(true)
      setIsResetting(true)
    } catch (error: any) {
      console.error('Recovery error:', error)
      setErrorMessage(error.message || 'Error al enviar recuperación')
    } finally {
      setIsRecoveryLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-300">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-primary animate-in fade-in slide-in-from-top-2 duration-300 delay-75">CRM Pro</CardTitle>
          <CardDescription className="text-lg mt-2 animate-in fade-in duration-300 delay-100">
            {isResetting ? 'Recuperar Contraseña' : t.auth.welcome}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div key={isResetting ? 'reset' : 'login'} className="animate-in fade-in slide-in-from-right-4 duration-200">
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
                <div className="animate-in fade-in slide-in-from-left-2 duration-200">
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

              {isResetting && (
                <div className="pt-4 border-t border-border mt-4">
                  <button
                    type="button"
                    onClick={() => setShowMoreOptions(!showMoreOptions)}
                    className="flex items-center justify-center gap-1 w-full text-sm text-muted-foreground hover:text-primary transition-colors py-1"
                  >
                    {showMoreOptions ? <CaretUp size={14} /> : <CaretDown size={14} />}
                    {showMoreOptions ? 'Menos opciones' : 'Ver más opciones (Correo alternativo)'}
                  </button>

                  {showMoreOptions && (
                    <div className="mt-4 space-y-4 p-4 bg-muted/50 rounded-lg border border-border animate-in slide-in-from-top-2 duration-200">
                      <div className="flex items-center gap-2 text-sm font-medium text-foreground mb-1">
                        <ShieldCheck size={18} className="text-primary" />
                        ¿No tienes acceso al correo principal?
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Ingresa tu correo alternativo de recuperación configurado en tu cuenta.
                      </p>
                      <div className="space-y-2">
                        <Input
                          type="email"
                          placeholder="correo@alternativo.com"
                          value={recoveryEmail}
                          onChange={(e) => setRecoveryEmail(e.target.value)}
                          disabled={isRecoveryLoading}
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          className="w-full"
                          onClick={handleRecoverySubmit}
                          disabled={isRecoveryLoading || !recoveryEmail}
                        >
                          {isRecoveryLoading ? (
                            <CircleNotch size={16} className="animate-spin mr-2" />
                          ) : null}
                          Enviar al correo alternativo
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {errorMessage && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-md text-center font-medium">
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
