import { Link } from 'react-router-dom'
import { ArrowLeftRight, Brain, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface SessionActionsProps {
  sessionId: string
  deleting?: boolean
  onDelete: (sessionId: string) => void
}

export function SessionActions({ sessionId, deleting, onDelete }: SessionActionsProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      <Link to={`/research-analysis?session=${sessionId}`} className="w-full sm:w-auto">
        <Button variant="secondary" className="min-h-11 w-full sm:min-h-9 sm:w-auto">
          <Brain className="mr-2 h-4 w-4" />
          Open Analysis
        </Button>
      </Link>
      <Link to={`/strategy-compare?session=${sessionId}`} className="w-full sm:w-auto">
        <Button variant="secondary" className="min-h-11 w-full sm:min-h-9 sm:w-auto">
          <ArrowLeftRight className="mr-2 h-4 w-4" />
          Compare
        </Button>
      </Link>
      <Button
        type="button"
        variant="ghost"
        className="min-h-11 w-full text-danger hover:text-danger sm:min-h-9 sm:w-auto"
        disabled={deleting}
        onClick={() => onDelete(sessionId)}
      >
        {deleting ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="mr-2 h-4 w-4" />
        )}
        Delete
      </Button>
    </div>
  )
}
