import { motion } from 'framer-motion'
import { Construction } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'

interface PlaceholderPageProps {
  title: string
  description: string
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex min-h-[60vh] w-full min-w-0 items-center justify-center px-2"
    >
      <EmptyState
        title={title}
        description={description}
        icon={<Construction className="h-6 w-6" />}
        className="mx-auto"
      />
    </motion.div>
  )
}
