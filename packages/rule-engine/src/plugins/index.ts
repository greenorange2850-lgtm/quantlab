import type { IRulePlugin } from '../types/index.js'
import { CrtPlugin } from './crt.plugin.js'
import { FvgPlugin } from './fvg.plugin.js'
import { LiquiditySweepPlugin } from './liquidity-sweep.plugin.js'
import { MssPlugin } from './mss.plugin.js'
import { BosPlugin } from './bos.plugin.js'
import { ChochPlugin } from './choch.plugin.js'
import { OrderBlockPlugin } from './order-block.plugin.js'
import { BreakerBlockPlugin } from './breaker-block.plugin.js'
import { EqualHighPlugin } from './equal-high.plugin.js'
import { EqualLowPlugin } from './equal-low.plugin.js'
import { PremiumDiscountPlugin } from './premium-discount.plugin.js'
import { VolumeSpikePlugin } from './volume-spike.plugin.js'
import { AtrExpansionPlugin } from './atr-expansion.plugin.js'

export function discoverPlugins(): IRulePlugin[] {
  return [
    new CrtPlugin(),
    new FvgPlugin(),
    new LiquiditySweepPlugin(),
    new MssPlugin(),
    new BosPlugin(),
    new ChochPlugin(),
    new OrderBlockPlugin(),
    new BreakerBlockPlugin(),
    new EqualHighPlugin(),
    new EqualLowPlugin(),
    new PremiumDiscountPlugin(),
    new VolumeSpikePlugin(),
    new AtrExpansionPlugin(),
  ]
}

export {
  CrtPlugin,
  FvgPlugin,
  LiquiditySweepPlugin,
  MssPlugin,
  BosPlugin,
  ChochPlugin,
  OrderBlockPlugin,
  BreakerBlockPlugin,
  EqualHighPlugin,
  EqualLowPlugin,
  PremiumDiscountPlugin,
  VolumeSpikePlugin,
  AtrExpansionPlugin,
}
