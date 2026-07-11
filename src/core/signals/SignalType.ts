export const SignalType = {
  BUY: 'BUY',
  SELL: 'SELL',
  HOLD: 'HOLD',
} as const

export type SignalType = (typeof SignalType)[keyof typeof SignalType]
