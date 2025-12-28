import { usePersistentState } from '@/hooks/usePersistentState'
import { Lead, Task, Pipeline } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts'
import { useEffect, useState } from 'react'
import { getLeadsCount } from '@/supabase/services/leads'

export function AnalyticsDashboard({ companyId }: { companyId?: string }) {
  const [leads] = usePersistentState<Lead[]>(`leads-${companyId}`, [])
  const [leadsCount, setLeadsCount] = useState(0)
  const [tasks] = usePersistentState<Task[]>(`tasks-${companyId}`, [])
  const [pipelines] = usePersistentState<Pipeline[]>(`pipelines-${companyId}`, [])

  useEffect(() => {
    if (companyId) {
      getLeadsCount(companyId)
        .then((count: any) => setLeadsCount(count || 0))
        .catch(err => console.error('Error fetching leads count:', err))
    }
  }, [companyId])

  // Generar pipelineData dinámicamente desde los pipelines reales del CRM
  // Comparamos con pipeline.id ya que los leads almacenan el pipeline_id (UUID)
  const pipelineData = (pipelines || []).map(pipeline => ({
    name: pipeline.name,
    count: (leads || []).filter(l => l.pipeline === pipeline.id).length
  }))

  // Calcular ancho dinámico para la gráfica de pipelines si son muchos
  const pipelineChartWidth = Math.max(100 + (pipelineData.length * 120), 600)

  const priorityData = [
    { name: 'High', value: (leads || []).filter(l => l.priority === 'high').length, color: '#ef4444' },
    { name: 'Medium', value: (leads || []).filter(l => l.priority === 'medium').length, color: '#f59e0b' },
    { name: 'Low', value: (leads || []).filter(l => l.priority === 'low').length, color: '#6b7280' }
  ]

  const taskCompletionData = [
    { name: 'Completed', value: (tasks || []).filter(t => t.completed).length },
    { name: 'Pending', value: (tasks || []).filter(t => !t.completed).length }
  ]

  const totalRevenue = (leads || []).reduce((sum, lead) => sum + lead.budget, 0)
  const avgDealSize = totalRevenue / ((leads || []).length || 1)

  return (
    <div className="flex-1 overflow-y-auto p-6 pb-24 md:pb-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Analítica</h1>
        <p className="text-muted-foreground mt-1">Información y métricas de rendimiento</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Ingresos totales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">En pipeline</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Tamaño promedio de la oferta</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${Math.round(avgDealSize).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Por lead</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Leads activos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{leadsCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Todos los pipelines</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Tareas Completadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(((tasks || []).filter(t => t.completed).length / ((tasks || []).length || 1)) * 100)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">Tareas completadas</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Leads por Pipeline</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto pb-4">
            <div style={{ width: pipelineChartWidth, height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pipelineData} margin={{ top: 20, right: 30, left: 20, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" interval={0} tick={{ fontSize: 12 }} height={60} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="oklch(0.45 0.15 250)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribución prioritaria</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={priorityData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => entry.name}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {priorityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
