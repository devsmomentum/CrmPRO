import { usePersistentState } from '@/hooks/usePersistentState'
import { Task } from '@/lib/types'
import { usePipelineData } from '@/hooks/usePipelineData'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { useEffect, useState } from 'react'
import { getLeadsCount } from '@/supabase/services/leads'
import {
  CurrencyDollar,
  TrendUp,
  Users,
  CheckCircle,
  ChartBar,
  ChartPieSlice,
  CaretUp,
  CaretDown
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

export function AnalyticsDashboard({ companyId }: { companyId?: string }) {
  const { user } = useAuth()
  const { leads, pipelines } = usePipelineData({
    companyId: companyId || '',
    userId: user?.id
  })
  const [tasks] = usePersistentState<Task[]>(`tasks-${companyId}`, [])

  const [dateRange, setDateRange] = useState<'30days' | 'quarter' | 'year'>('30days')
  const [metrics, setMetrics] = useState({
    totalRevenue: 0,
    revenueTrend: 0,
    avgDealSize: 0,
    dealSizeTrend: 0,
    activeLeads: 0,
    leadsTrend: 0,
    completionRate: 0,
    tasksTrend: 0
  })

  useEffect(() => {
    if (!leads.length) return

    const now = new Date()
    let startDate = new Date()
    let prevStartDate = new Date()

    if (dateRange === '30days') {
      startDate.setDate(now.getDate() - 30)
      prevStartDate.setDate(now.getDate() - 60)
    } else if (dateRange === 'quarter') {
      startDate.setMonth(now.getMonth() - 3)
      prevStartDate.setMonth(now.getMonth() - 6)
    } else {
      startDate.setFullYear(now.getFullYear() - 1)
      prevStartDate.setFullYear(now.getFullYear() - 2)
    }

    // Filter current period
    const currentLeads = leads.filter(l => new Date(l.createdAt) >= startDate)
    const prevLeads = leads.filter(l => {
      const d = new Date(l.createdAt)
      return d >= prevStartDate && d < startDate
    })

    // Calculate Metrics
    const currentRevenue = currentLeads.reduce((acc, l) => acc + (l.budget || 0), 0)
    const prevRevenue = prevLeads.reduce((acc, l) => acc + (l.budget || 0), 0)

    const currentAvgDeal = currentLeads.length ? currentRevenue / currentLeads.length : 0
    const prevAvgDeal = prevLeads.length ? prevRevenue / prevLeads.length : 0

    const currentTasks = (tasks || []).filter(t => new Date(t.dueDate) >= startDate && t.completed).length
    const totalCurrentTasks = (tasks || []).filter(t => new Date(t.dueDate) >= startDate).length
    const taskRate = totalCurrentTasks ? Math.round((currentTasks / totalCurrentTasks) * 100) : 0

    const calcTrend = (curr: number, prev: number) => {
      if (!prev) return curr > 0 ? 100 : 0
      return Math.round(((curr - prev) / prev) * 100)
    }

    setMetrics({
      totalRevenue: currentRevenue,
      revenueTrend: calcTrend(currentRevenue, prevRevenue),
      avgDealSize: currentAvgDeal,
      dealSizeTrend: calcTrend(currentAvgDeal, prevAvgDeal),
      activeLeads: currentLeads.length,
      leadsTrend: calcTrend(currentLeads.length, prevLeads.length),
      completionRate: taskRate,
      tasksTrend: 0 // Mock for now as tasks don't have prev data easily accessible here
    })

    // Update charts data based on filtered leads...
  }, [leads, tasks, dateRange])

  const pipelineData = (pipelines || []).map(pipeline => ({
    name: pipeline.name,
    count: (leads || []).filter(l => l.pipeline === pipeline.id).length
  }))

  const pipelineChartWidth = Math.max(100 + (pipelineData.length * 120), 600)

  const priorityData = [
    { name: 'Alta', value: (leads || []).filter(l => l.priority === 'high').length, color: '#f43f5e' },
    { name: 'Media', value: (leads || []).filter(l => l.priority === 'medium').length, color: '#f59e0b' },
    { name: 'Baja', value: (leads || []).filter(l => l.priority === 'low').length, color: '#10b981' }
  ]

  const totalRevenue = (leads || []).reduce((sum, lead) => sum + (lead.budget || 0), 0)
  const avgDealSize = totalRevenue / ((leads || []).length || 1)
  const completedTasks = (tasks || []).filter(t => t.completed).length
  const totalTasks = (tasks || []).length
  const completionRate = Math.round((completedTasks / (totalTasks || 1)) * 100)

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background/95 backdrop-blur-md border border-border p-3 rounded-xl shadow-xl animate-in fade-in zoom-in duration-200">
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
          <p className="text-sm font-bold text-primary flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary" />
            {payload[0].value.toLocaleString()} {payload[0].name === 'count' ? 'Leads' : ''}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 pb-32 space-y-8 bg-[#f8fafc] dark:bg-background">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-foreground bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
            Analítica
          </h1>
          <p className="text-muted-foreground mt-2 font-medium flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Información y métricas de rendimiento en tiempo real
          </p>
        </div>
        <div className="flex items-center gap-2 bg-background border border-border/50 p-1.5 rounded-2xl shadow-sm">
          <div className="px-4 py-1.5 bg-muted rounded-xl text-xs font-bold text-muted-foreground transition-all cursor-pointer hover:bg-muted/80" onClick={() => setDateRange('30days')} data-active={dateRange === '30days'} style={dateRange === '30days' ? { backgroundColor: 'var(--primary)', color: 'white' } : {}}>Últimos 30 días</div>
          <button className="px-4 py-1.5 hover:bg-muted rounded-xl text-xs font-bold text-muted-foreground transition-all" onClick={() => setDateRange('quarter')} style={dateRange === 'quarter' ? { backgroundColor: 'var(--primary)', color: 'white' } : {}}>Este trimestre</button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard
          title="Ingresos Totales"
          value={`$${metrics.totalRevenue.toLocaleString()}`}
          subtitle="En periodo seleccionado"
          icon={<CurrencyDollar size={24} weight="duotone" />}
          gradient="from-emerald-500/20 to-emerald-500/5 text-emerald-600 dark:text-emerald-400"
          trend={`${metrics.revenueTrend > 0 ? '+' : ''}${metrics.revenueTrend}%`}
          trendUp={metrics.revenueTrend >= 0}
        />
        <KpiCard
          title="Promedio Oferta"
          value={`$${Math.round(metrics.avgDealSize).toLocaleString()}`}
          subtitle="Valor medio por lead"
          icon={<TrendUp size={24} weight="duotone" />}
          gradient="from-blue-500/20 to-blue-500/5 text-blue-600 dark:text-blue-400"
          trend={`${metrics.dealSizeTrend > 0 ? '+' : ''}${metrics.dealSizeTrend}%`}
          trendUp={metrics.dealSizeTrend >= 0}
        />
        <KpiCard
          title="Leads Nuevos"
          value={metrics.activeLeads.toString()}
          subtitle="En periodo seleccionado"
          icon={<Users size={24} weight="duotone" />}
          gradient="from-indigo-500/20 to-indigo-500/5 text-indigo-600 dark:text-indigo-400"
          trend={`${metrics.leadsTrend > 0 ? '+' : ''}${metrics.leadsTrend}%`}
          trendUp={metrics.leadsTrend >= 0}
        />
        <KpiCard
          title="Tasa Completitud"
          value={`${metrics.completionRate}%`}
          subtitle="Tareas completadas"
          icon={<CheckCircle size={24} weight="duotone" />}
          gradient="from-violet-500/20 to-violet-500/5 text-violet-600 dark:text-violet-400"
          trend="0%"
          trendUp={true}
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Pipeline Bar Chart */}
        <Card className="border-none shadow-2xl shadow-black/5 rounded-[2rem] overflow-hidden bg-background">
          <CardHeader className="p-8 pb-0 flex flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xl font-black tracking-tight flex items-center gap-2">
                <ChartBar size={24} weight="duotone" className="text-primary" />
                Leads por Pipeline
              </CardTitle>
              <p className="text-sm text-muted-foreground font-medium">Distribución volumétrica por etapa</p>
            </div>
          </CardHeader>
          <CardContent className="p-8 pt-6 overflow-x-auto">
            <div style={{ width: pipelineChartWidth, height: 350 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pipelineData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={1} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.6} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.4} />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fontWeight: 700, fill: 'var(--muted-foreground)' }}
                    height={40}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fontWeight: 700, fill: 'var(--muted-foreground)' }}
                  />
                  <Tooltip cursor={{ fill: 'var(--muted)', opacity: 0.4 }} content={<CustomTooltip />} />
                  <Bar
                    dataKey="count"
                    fill="url(#barGradient)"
                    radius={[10, 10, 0, 0]}
                    barSize={40}
                    animationDuration={1500}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Priority Distribution Pie Chart */}
        <Card className="border-none shadow-2xl shadow-black/5 rounded-[2rem] overflow-hidden bg-background">
          <CardHeader className="p-8 pb-0">
            <div className="space-y-1">
              <CardTitle className="text-xl font-black tracking-tight flex items-center gap-2">
                <ChartPieSlice size={24} weight="duotone" className="text-primary" />
                Distribución Prioritaria
              </CardTitle>
              <p className="text-sm text-muted-foreground font-medium">Análisis de criticidad de leads</p>
            </div>
          </CardHeader>
          <CardContent className="p-8 flex flex-col items-center">
            <div className="w-full h-[350px] relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={priorityData}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={120}
                    paddingAngle={8}
                    dataKey="value"
                    animationDuration={1500}
                  >
                    {priorityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl font-black">{(leads || []).length}</span>
                <span className="text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground">Total Leads</span>
              </div>
            </div>

            <div className="flex gap-6 mt-4">
              {priorityData.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-xs font-bold text-muted-foreground">{item.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function KpiCard({ title, value, subtitle, icon, gradient, trend, trendUp }: any) {
  return (
    <Card className="border-none shadow-2xl shadow-black/5 rounded-[2rem] overflow-hidden group hover:scale-[1.02] transition-all duration-300 bg-background">
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className={cn("p-3 rounded-2xl bg-gradient-to-br shadow-inner ring-1 ring-black/5", gradient)}>
            {icon}
          </div>
          <div className={cn(
            "flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider uppercase",
            trendUp ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"
          )}>
            {trendUp ? <CaretUp size={12} weight="bold" /> : <CaretDown size={12} weight="bold" />}
            {trend}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1 opacity-70">{title}</h3>
          <div className="text-3xl font-black tracking-tight mb-1">{value}</div>
          <p className="text-xs text-muted-foreground/80 font-medium">{subtitle}</p>
        </div>
      </CardContent>
    </Card>
  )
}
