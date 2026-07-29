import { motion } from 'framer-motion'
import { BacktestSetupForm } from '@/features/backtest/BacktestSetupForm'

export function BacktestLabPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <BacktestSetupForm
        title="Backtest Lab"
        description="Configure symbol and timeframe from live Binance markets, then run historical backtests."
        variant="backtest"
      />
    </motion.div>
  )
}
