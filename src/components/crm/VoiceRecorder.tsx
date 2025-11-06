import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Microphone, Stop, PaperPlaneRight } from '@phosphor-icons/react'
import { useKV } from '@github/spark/hooks'
import { Task, TeamMember } from '@/lib/types'
import { toast } from 'sonner'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'

interface VoiceRecorderProps {
  onClose: () => void
}

export function VoiceRecorder({ onClose }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [transcription, setTranscription] = useState('')
  const [assignTo, setAssignTo] = useState('')
  const [tasks, setTasks] = useKV<Task[]>('tasks', [])
  const [teamMembers] = useKV<TeamMember[]>('team-members', [])

  const handleRecord = async () => {
    if (!isRecording) {
      setIsRecording(true)
      toast.info('Recording started...')
      
      setTimeout(() => {
        setIsRecording(false)
        setIsProcessing(true)
        
        setTimeout(() => {
          const sampleTranscription = 'Follow up with ABC Company about the proposal. Priority is high. Need to schedule a demo call next week.'
          setTranscription(sampleTranscription)
          setIsProcessing(false)
          toast.success('Audio transcribed successfully!')
        }, 2000)
      }, 3000)
    } else {
      setIsRecording(false)
    }
  }

  const handleCreateTask = () => {
    if (!transcription || !assignTo) {
      toast.error('Please complete recording and assign to someone')
      return
    }

    const newTask: Task = {
      id: Date.now().toString(),
      title: transcription.split('.')[0],
      description: transcription,
      assignedTo: assignTo,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      completed: false,
      priority: transcription.toLowerCase().includes('high') ? 'high' : 'medium',
      createdBy: 'Current User'
    }

    setTasks((current) => [...(current || []), newTask])
    toast.success('Task created and assigned!')
    onClose()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-4">
        <div className={`w-24 h-24 rounded-full flex items-center justify-center ${
          isRecording ? 'bg-destructive animate-pulse' : 'bg-primary'
        }`}>
          {isRecording ? (
            <Stop size={40} className="text-white" weight="fill" />
          ) : (
            <Microphone size={40} className="text-white" weight="fill" />
          )}
        </div>
        
        <Button 
          onClick={handleRecord} 
          disabled={isProcessing}
          size="lg"
          variant={isRecording ? 'destructive' : 'default'}
        >
          {isRecording ? 'Stop Recording' : isProcessing ? 'Processing...' : 'Start Recording'}
        </Button>
      </div>

      {transcription && (
        <div className="space-y-4">
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm font-medium mb-2">Transcription:</p>
            <p className="text-sm">{transcription}</p>
          </div>

          <div className="space-y-2">
            <Label>Assign To</Label>
            <Select value={assignTo} onValueChange={setAssignTo}>
              <SelectTrigger>
                <SelectValue placeholder="Select team member" />
              </SelectTrigger>
              <SelectContent>
                {(teamMembers || []).map(member => (
                  <SelectItem key={member.id} value={member.name}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleCreateTask} className="w-full" size="lg">
            <PaperPlaneRight className="mr-2" size={20} />
            Create Task
          </Button>
        </div>
      )}
    </div>
  )
}
