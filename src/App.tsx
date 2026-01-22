import { Routes, Route, Navigate, useSearchParams, useNavigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { Dashboard } from '@/components/crm/Dashboard'
import { PipelineView } from '@/components/crm/PipelineView'
import { ChatsView } from '@/components/crm/ChatsView'
import { AnalyticsDashboard } from '@/components/crm/AnalyticsDashboard'
import { CalendarView } from '@/components/crm/CalendarView'
import { TeamView } from '@/components/crm/TeamView'
import { SettingsView } from '@/components/crm/SettingsView'
import { NotificationsView } from '@/components/crm/NotificationsView'
import LoginView from '@/components/crm/LoginView'
import { RegisterView } from '@/components/crm/RegisterView'
import { JoinTeam } from '@/components/crm/JoinTeam'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { CRMLayout } from '@/components/layout/CRMLayout'
import { useAuth } from '@/hooks/useAuth'
import { LoadingScreen } from '@/components/ui/LoadingScreen'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { verifyEmpresaTable, testInsertEmpresa, listEmpresasCurrentUser, testRLSViolation } from '@/supabase/diagnostics/empresaDebug'

function App() {
  const { user, isLoading, login, register, companies, currentCompanyId, setCurrentCompanyId, fetchCompanies } = useAuth()

  // Debug tools
  useEffect(() => {
    ; (window as any).empDiag = {
      verifyEmpresaTable,
      testInsertEmpresa,
      listEmpresasCurrentUser,
      testRLSViolation
    }
    console.log('[EMPRESA:DIAG] Herramientas empDiag disponibles en window.empDiag')
  }, [])

  if (isLoading) {
    return <LoadingScreen />
  }

  return (
    <>
      <Routes>
        {/* Auth Routes */}
        <Route path="/login" element={
          user ? <Navigate to="/dashboard" replace /> : (
            <LoginView
              onLogin={login}
              onSwitchToRegister={() => { }}
            />
          )
        } />
        <Route path="/register" element={
          user ? <Navigate to="/dashboard" replace /> : (
            <RegisterView
              onRegister={register}
              onSwitchToLogin={() => { }}
            />
          )
        } />

        {/* Join Team Route */}
        <Route path="/join" element={<JoinTeamWrapper />} />

        {/* Protected CRM Routes */}
        <Route element={<ProtectedRoute><CRMLayout /></ProtectedRoute>}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={
            <Dashboard
              companyId={currentCompanyId}
              onShowNotifications={() => { }}
            />
          } />
          <Route path="/pipeline" element={
            <PipelineView
              companyId={currentCompanyId}
              companies={companies}
              user={user!}
            />
          } />
          <Route path="/chats" element={
            <ChatsViewWrapper />
          } />
          <Route path="/analytics" element={
            <AnalyticsDashboard companyId={currentCompanyId} />
          } />
          <Route path="/calendar" element={
            <CalendarView companyId={currentCompanyId} />
          } />
          <Route path="/team" element={
            <TeamView
              companyId={currentCompanyId}
              companies={companies}
              currentUserId={user?.id || ''}
              currentUserEmail={user?.email || ''}
            />
          } />
          <Route path="/settings" element={
            <SettingsViewWrapper />
          } />
          <Route path="/notifications" element={
            <NotificationsViewWrapper />
          } />
        </Route>

        {/* Guest Mode Routes */}
        <Route path="/guest" element={<ProtectedRoute><CRMLayout isGuestMode /></ProtectedRoute>}>
          <Route index element={<Navigate to="/guest/dashboard" replace />} />
          <Route path="dashboard" element={
            <Dashboard
              companyId={currentCompanyId}
              onShowNotifications={() => { }}
            />
          } />
          <Route path="pipeline" element={
            <PipelineView
              companyId={currentCompanyId}
              companies={companies}
              user={user!}
            />
          } />
          <Route path="chats" element={
            <ChatsViewWrapper />
          } />
          <Route path="analytics" element={
            <AnalyticsDashboard companyId={currentCompanyId} />
          } />
          <Route path="calendar" element={
            <CalendarView companyId={currentCompanyId} />
          } />
          <Route path="team" element={
            <TeamView
              companyId={currentCompanyId}
              companies={companies}
              currentUserId={user?.id || ''}
              currentUserEmail={user?.email || ''}
            />
          } />
          <Route path="settings" element={
            <SettingsViewWrapper />
          } />
          <Route path="notifications" element={
            <NotificationsViewWrapper />
          } />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to={user ? "/dashboard" : "/login"} replace />} />
      </Routes>
      <Toaster />
    </>
  )
}

// Wrapper components para pasar props correctamente
function ChatsViewWrapper() {
  const { user, companies, currentCompanyId } = useAuth()
  const navigate = useNavigate()

  const currentCompany = companies.find(c => c.id === currentCompanyId)
  const isOwner = currentCompany?.ownerId === user?.id
  const isAdmin = (currentCompany?.role || '').toLowerCase() === 'admin'
  const canDeleteLead = !!(isOwner || isAdmin)

  return (
    <ChatsView
      companyId={currentCompanyId}
      canDeleteLead={canDeleteLead}
      onNavigateToPipeline={(leadId) => {
        sessionStorage.setItem('openLeadId', leadId)
        const isGuestMode = currentCompany && user && currentCompany.ownerId !== user.id
        navigate(isGuestMode ? '/guest/pipeline' : '/pipeline')
      }}
    />
  )
}

function SettingsViewWrapper() {
  const { user, companies, currentCompanyId, setCurrentCompanyId, setCompanies, logout } = useAuth()

  return (
    <SettingsView
      currentUserId={user?.id || ''}
      currentCompanyId={currentCompanyId}
      onCompanyChange={setCurrentCompanyId}
      companies={companies}
      setCompanies={setCompanies}
      onLogout={logout}
    />
  )
}

function NotificationsViewWrapper() {
  const { user, fetchCompanies, setCurrentCompanyId } = useAuth()
  const navigate = useNavigate()

  return (
    <NotificationsView
      onInvitationAccepted={async (newCompanyId) => {
        await fetchCompanies()
        if (newCompanyId) {
          setCurrentCompanyId(newCompanyId)
        }
        navigate('/dashboard')
      }}
    />
  )
}

function JoinTeamWrapper() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const { user, login, fetchCompanies, setCurrentCompanyId } = useAuth()
  const navigate = useNavigate()
  const [showLogin, setShowLogin] = useState(false)

  // Si no hay token, redirigir al dashboard o login
  if (!token) {
    return <Navigate to={user ? "/dashboard" : "/login"} replace />
  }

  // Usuario logueado con token
  if (user) {
    return (
      <>
        <JoinTeam
          token={token}
          user={user}
          onSuccess={async () => {
            await fetchCompanies()
            toast.success('¡Te has unido exitosamente! Ahora puedes ver la empresa desde el selector.')
            navigate('/dashboard')
          }}
          onLoginRequest={() => { }}
        />
        <Toaster />
      </>
    )
  }

  // Usuario no logueado - mostrar login o JoinTeam
  if (showLogin) {
    return (
      <>
        <LoginView
          onLogin={async (email, password) => {
            await login(email, password)
            // El token se maneja en la siguiente renderización
          }}
          onSwitchToRegister={() => navigate('/register')}
        />
        <Toaster />
      </>
    )
  }

  return (
    <>
      <JoinTeam
        token={token}
        user={null}
        onSuccess={() => { }}
        onLoginRequest={() => setShowLogin(true)}
      />
      <Toaster />
    </>
  )
}

export default App