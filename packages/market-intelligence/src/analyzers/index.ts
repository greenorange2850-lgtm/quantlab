import { TrendAnalyzer } from './trend.analyzer.js'
import { VolatilityAnalyzer } from './volatility.analyzer.js'
import { LiquidityAnalyzer } from './liquidity.analyzer.js'
import { SessionAnalyzer } from './session.analyzer.js'
import { SpreadAnalyzer } from './spread.analyzer.js'
import { MomentumAnalyzer } from './momentum.analyzer.js'
import { RangeAnalyzer } from './range.analyzer.js'
import { StructureAnalyzer } from './structure.analyzer.js'
import { MtfAnalyzer } from './mtf.analyzer.js'
import { RiskAnalyzer } from './risk.analyzer.js'
import type { IAnalyzer } from '../types/index.js'

export function createAnalyzers(): IAnalyzer[] {
  return [
    new TrendAnalyzer(),
    new VolatilityAnalyzer(),
    new LiquidityAnalyzer(),
    new SessionAnalyzer(),
    new SpreadAnalyzer(),
    new MomentumAnalyzer(),
    new RangeAnalyzer(),
    new StructureAnalyzer(),
    new MtfAnalyzer(),
    new RiskAnalyzer(),
  ]
}

export {
  TrendAnalyzer,
  VolatilityAnalyzer,
  LiquidityAnalyzer,
  SessionAnalyzer,
  SpreadAnalyzer,
  MomentumAnalyzer,
  RangeAnalyzer,
  StructureAnalyzer,
  MtfAnalyzer,
  RiskAnalyzer,
}
