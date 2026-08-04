import { motion } from 'framer-motion'
import { BacktestSetupForm } from '@/features/backtest/BacktestSetupForm'

export function StrategyLabPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <BacktestSetupForm
        title="Strategy Lab"
        description="Choose Binance Live or a Local Dataset, then run the strategy → risk → analytics pipeline."
        variant="strategy"
      />
    </motion.div>
  )
}
