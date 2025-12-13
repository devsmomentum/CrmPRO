import { usePersistentState } from '@/hooks/usePersistentState'
import { Lead, Task, Pipeline } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts'

export function AnalyticsDashboard({ companyId }: { companyId?: string }) {
  const [leads] = usePersistentState<Lead[]>(`leads-${companyId}`, [])
  const [tasks] = usePersistentState<Task[]>(`tasks-${companyId}`, [])
  const [pipelines] = usePersistentState<Pipeline[]>(`pipelines-${companyId}`, [])

  // Generar pipelineData dinámicamente desde los pipelines reales del CRM
  const pipelineData = (pipelines || []).map(pipeline => ({
    name: pipeline.name,
    count: (leads || []).filter(l => l.pipeline === pipeline.type).length
  }))

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
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Analytics</h1>
        <p className="text-muted-foreground mt-1">Performance insights and metrics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">In pipeline</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Deal Size</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${Math.round(avgDealSize).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Per lead</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(leads || []).length}</div>
            <p className="text-xs text-muted-foreground mt-1">All pipelines</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Task Completion</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(((tasks || []).filter(t => t.completed).length / ((tasks || []).length || 1)) * 100)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">Tasks completed</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Leads by Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={pipelineData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="oklch(0.45 0.15 250)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Priority Distribution</CardTitle>
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
