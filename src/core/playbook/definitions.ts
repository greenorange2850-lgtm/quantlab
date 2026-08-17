// ─── Playbook Engine — Built-in Definitions ───────────────────────────────────
//
// Definitions are JSON-safe, versioned and immutable. They declare parameter
// schemas (so Random Search can optimize later) and check templates that the
// UI renders regardless of live data.

import { canonicalStringify } from './json.js'
import type {
  PlaybookBias,
  PlaybookCheckTemplate,
  PlaybookDefinition,
  PlaybookKind,
  PlaybookParameterSchema,
} from './types.js'

export const PLAYBOOK_SCHEMA_VERSION = 1

interface BuildDefinitionInput {
  id: string
  name: string
  description: string
  kind: PlaybookKind
  bias: PlaybookBias
  tags: string[]
  parameterSchema: PlaybookParameterSchema[]
  checks: PlaybookCheckTemplate[]
}

const SHARED_PARAMETERS: PlaybookParameterSchema[] = [
  {
    key: 'trendStrength',
    label: 'Trend strength',
    type: 'number',
    default: 2,
    min: 1,
    max: 5,
    step: 1,
    group: 'required',
    description: 'Required number of structural swing confirmations for context.',
  },
  {
    key: 'swingLookback',
    label: 'Swing lookback',
    type: 'number',
    default: 5,
    min: 2,
    max: 20,
    step: 1,
    group: 'required',
    description: 'Candles each side used to define a swing point.',
  },
  {
    key: 'maxZoneAge',
    label: 'Max zone age',
    type: 'number',
    default: 20,
    min: 5,
    max: 100,
    step: 1,
    group: 'required',
    description: 'Max bars before the zone expires.',
  },
  {
    key: 'maxTouches',
    label: 'Max zone touches',
    type: 'number',
    default: 3,
    min: 0,
    max: 10,
    step: 1,
    group: 'required',
    description: 'Zone too-touched threshold.',
  },
  {
    key: 'minScore',
    label: 'Minimum score',
    type: 'number',
    default: 60,
    min: 0,
    max: 100,
    step: 1,
    group: 'required',
    description: 'Strength required before a READY setup becomes actionable.',
  },
  {
    key: 'rr',
    label: 'Reward / risk',
    type: 'number',
    default: 2,
    min: 1,
    max: 10,
    step: 0.5,
    group: 'required',
    description: 'Risk multiple used to derive the first target.',
  },
  {
    key: 'stopBuffer',
    label: 'Stop buffer (ATR)',
    type: 'number',
    default: 0,
    min: 0,
    max: 3,
    step: 0.1,
    group: 'required',
    description: 'Extra ATR distance added beyond the stop reference.',
  },
  {
    key: 'atrPeriod',
    label: 'ATR period',
    type: 'number',
    default: 14,
    min: 2,
    max: 50,
    step: 1,
    group: 'required',
    description: 'Period used for ATR-based sizing and stop buffer.',
  },
]

const QML_REQUIRED: PlaybookParameterSchema[] = [
  {
    key: 'requireSweep',
    label: 'Require sweep',
    type: 'boolean',
    default: false,
    group: 'optional',
    description: 'Promotes the SSL/BLS sweep to a required check.',
  },
  {
    key: 'requireRejection',
    label: 'Require rejection',
    type: 'boolean',
    default: false,
    group: 'optional',
    description: 'Promotes the bullish/bearish rejection candle to a required check.',
  },
  {
    key: 'requireDisplacement',
    label: 'Require displacement',
    type: 'boolean',
    default: false,
    group: 'optional',
    description: 'Promotes the impulse/displacement to a required check.',
  },
  {
    key: 'requireFvg',
    label: 'Require FVG',
    type: 'boolean',
    default: false,
    group: 'optional',
    description: 'Promotes the FVG confluence to a required check.',
  },
  {
    key: 'requireOb',
    label: 'Require OB',
    type: 'boolean',
    default: false,
    group: 'optional',
    description: 'Promotes the OB confluence to a required check.',
  },
  {
    key: 'sweepTolerance',
    label: 'Sweep tolerance %',
    type: 'number',
    default: 0.0002,
    min: 0,
    max: 0.01,
    step: 0.0001,
    group: 'optional',
    description: 'Extra distance beyond the swept level before a sweep counts.',
  },
]

const CONTINUATION_REQUIRED: PlaybookParameterSchema[] = [
  {
    key: 'requireFvg',
    label: 'Require FVG',
    type: 'boolean',
    default: false,
    group: 'optional',
    description: 'Require the active FVG zone (either FVG or OB must be present).',
  },
  {
    key: 'requireOb',
    label: 'Require OB',
    type: 'boolean',
    default: false,
    group: 'optional',
    description: 'Require the active OB zone (either FVG or OB must be present).',
  },
  {
    key: 'requireSweep',
    label: 'Require sweep',
    type: 'boolean',
    default: false,
    group: 'optional',
    description: 'Promotes the sweep to a required check.',
  },
  {
    key: 'requireDisplacement',
    label: 'Require displacement',
    type: 'boolean',
    default: false,
    group: 'optional',
    description: 'Promotes the displacement to a required check.',
  },
  {
    key: 'requireDowAlignment',
    label: 'Require Dow alignment',
    type: 'boolean',
    default: true,
    group: 'optional',
    description: 'Require the higher-timeframe-style trend to agree with the playbook bias.',
  },
  {
    key: 'requireFreshZone',
    label: 'Require fresh zone',
    type: 'boolean',
    default: false,
    group: 'optional',
    description: 'Require the zone to be untouched before entry.',
  },
  {
    key: 'requireFirstRetest',
    label: 'Require first retest',
    type: 'boolean',
    default: false,
    group: 'optional',
    description: 'Require the current move to be the first retest of the zone.',
  },
]

function buildDefinition(input: BuildDefinitionInput): PlaybookDefinition {
  const payload = {
    id: input.id,
    name: input.name,
    description: input.description,
    version: '1.0.0',
    schemaVersion: PLAYBOOK_SCHEMA_VERSION,
    kind: input.kind,
    bias: input.bias,
    tags: input.tags,
    parameterSchema: input.parameterSchema,
    checks: input.checks,
  }
  const serialized = canonicalStringify(payload)
  return Object.freeze({
    ...payload,
    serialized,
  })
}

// ─── QML Reversal ─────────────────────────────────────────────────────────────

const qmlBullishChecks: PlaybookCheckTemplate[] = [
  { id: 'qml-context', label: 'Bearish context', required: true },
  { id: 'qml-lh-ll', label: 'Lower highs + lower lows structure', required: true },
  { id: 'qml-break', label: 'Break above latest valid LH', required: true },
  { id: 'qml-choch', label: 'Bullish CHoCH', required: true },
  { id: 'qml-zone', label: 'Broken LH becomes QML zone', required: true },
  { id: 'qml-retest', label: 'Later retest of QML zone', required: true },
  { id: 'qml-sweep', label: 'Sell-side liquidity sweep', required: false },
  { id: 'qml-rejection', label: 'Bullish rejection', required: false },
  { id: 'qml-displacement', label: 'Displacement', required: false },
  { id: 'qml-fvg', label: 'FVG confluence', required: false },
  { id: 'qml-ob', label: 'OB confluence', required: false },
]

const qmlBearishChecks: PlaybookCheckTemplate[] = qmlBullishChecks.map((c) => {
  const swapped: Record<string, string> = {
    'Bearish context': 'Bullish context',
    'Lower highs + lower lows structure': 'Higher highs + higher lows structure',
    'Break above latest valid LH': 'Break below latest valid HL',
    'Bullish CHoCH': 'Bearish CHoCH',
    'Broken LH becomes QML zone': 'Broken HL becomes QML zone',
    'Later retest of QML zone': 'Later retest of QML zone',
    'Sell-side liquidity sweep': 'Buy-side liquidity sweep',
    'Bullish rejection': 'Bearish rejection',
  }
  return { id: c.id, required: c.required, label: swapped[c.label] ?? c.label }
})

export const BULLISH_QML_REVERSAL = buildDefinition({
  id: 'bullish-qml-reversal',
  name: 'Bullish QML Reversal',
  description:
    'Reversal play after a bearish structure: a broken lower high becomes the QML zone, ' +
    'confirmed by a bullish CHoCH, waiting for a retest of the zone.',
  kind: 'qml-reversal',
  bias: 'bullish',
  tags: ['qml', 'reversal', 'structure'],
  parameterSchema: [...SHARED_PARAMETERS, ...QML_REQUIRED],
  checks: qmlBullishChecks,
})

export const BEARISH_QML_REVERSAL = buildDefinition({
  id: 'bearish-qml-reversal',
  name: 'Bearish QML Reversal',
  description:
    'Mirror of the Bullish QML Reversal: a broken higher low becomes the QML zone, ' +
    'confirmed by a bearish CHoCH, waiting for a retest of the zone.',
  kind: 'qml-reversal',
  bias: 'bearish',
  tags: ['qml', 'reversal', 'structure'],
  parameterSchema: [...SHARED_PARAMETERS, ...QML_REQUIRED],
  checks: qmlBearishChecks,
})

// ─── Continuation ─────────────────────────────────────────────────────────────

const continuationBullishChecks: PlaybookCheckTemplate[] = [
  { id: 'cont-bos', label: 'Valid BOS in trend direction', required: true },
  { id: 'cont-zone', label: 'Active FVG/OB zone', required: true },
  { id: 'cont-zone-alive', label: 'Zone alive', required: true },
  { id: 'cont-conflict', label: 'No opposing structure conflict', required: true },
  { id: 'cont-sweep', label: 'Sweep of opposing liquidity', required: false },
  { id: 'cont-displacement', label: 'Displacement', required: false },
  { id: 'cont-dow', label: 'Dow alignment', required: false },
  { id: 'cont-fresh-zone', label: 'Fresh zone', required: false },
  { id: 'cont-first-retest', label: 'First retest', required: false },
]

const continuationBearishChecks: PlaybookCheckTemplate[] = continuationBullishChecks.map((c) => ({
  id: c.id,
  required: c.required,
  label:
    c.label === 'Valid BOS in trend direction'
      ? 'Valid BOS in trend direction'
      : c.label,
}))

export const BULLISH_CONTINUATION = buildDefinition({
  id: 'bullish-continuation',
  name: 'Bullish Continuation',
  description:
    'Continuation play: a valid BOS in a bullish structure with an active, alive FVG/OB zone ' +
    'and no opposing structure conflict.',
  kind: 'continuation',
  bias: 'bullish',
  tags: ['continuation', 'bos', 'fvg', 'order-block'],
  parameterSchema: [...SHARED_PARAMETERS, ...CONTINUATION_REQUIRED],
  checks: continuationBullishChecks,
})

export const BEARISH_CONTINUATION = buildDefinition({
  id: 'bearish-continuation',
  name: 'Bearish Continuation',
  description:
    'Continuation play: a valid BOS in a bearish structure with an active, alive FVG/OB zone ' +
    'and no opposing structure conflict.',
  kind: 'continuation',
  bias: 'bearish',
  tags: ['continuation', 'bos', 'fvg', 'order-block'],
  parameterSchema: [...SHARED_PARAMETERS, ...CONTINUATION_REQUIRED],
  checks: continuationBearishChecks,
})

export const BUILTIN_PLAYBOOKS: readonly PlaybookDefinition[] = [
  BULLISH_QML_REVERSAL,
  BEARISH_QML_REVERSAL,
  BULLISH_CONTINUATION,
  BEARISH_CONTINUATION,
]
