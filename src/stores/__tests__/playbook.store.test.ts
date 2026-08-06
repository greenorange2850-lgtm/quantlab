import { beforeEach, describe, expect, it } from 'vitest'
import { BULLISH_QML_REVERSAL, BEARISH_CONTINUATION, defaultParameters } from '@/core/playbook'
import { isDraftDirty, usePlaybookStore } from '../playbook.store'
import { partializePlaybookState } from '../persistence'

describe('playbook store', () => {
  beforeEach(() => {
    usePlaybookStore.setState({
      selectedPlaybookId: 'bullish-qml-reversal',
      drafts: {},
      applied: {},
    })
  })

  it('defaults to the bullish QML reversal playbook', () => {
    expect(usePlaybookStore.getState().selectedPlaybookId).toBe('bullish-qml-reversal')
  })

  it('selects a playbook', () => {
    usePlaybookStore.getState().selectPlaybook('bearish-continuation')
    expect(usePlaybookStore.getState().selectedPlaybookId).toBe('bearish-continuation')
  })

  it('patches a single parameter on the draft', () => {
    const { updateParameter } = usePlaybookStore.getState()
    updateParameter('bullish-qml-reversal', 'rr', 3)
    const draft = usePlaybookStore.getState().drafts['bullish-qml-reversal']
    expect(draft).toEqual({ rr: 3 })
  })

  it('seeds a draft with defaults', () => {
    const defaults = defaultParameters(BULLISH_QML_REVERSAL)
    usePlaybookStore.getState().setDraft('bullish-qml-reversal', defaults)
    expect(usePlaybookStore.getState().drafts['bullish-qml-reversal']).toEqual(defaults)
  })

  it('resets a draft to schema defaults', () => {
    usePlaybookStore.getState().setDraft('bullish-qml-reversal', { rr: 9 })
    usePlaybookStore.getState().resetDraft('bullish-qml-reversal', BULLISH_QML_REVERSAL)
    expect(usePlaybookStore.getState().drafts['bullish-qml-reversal']).toEqual(
      defaultParameters(BULLISH_QML_REVERSAL),
    )
  })

  it('marks a draft as applied and resolves missing keys', () => {
    const { setDraft, applyDraft } = usePlaybookStore.getState()
    setDraft('bullish-qml-reversal', { rr: 3 })
    applyDraft('bullish-qml-reversal', BULLISH_QML_REVERSAL)

    const { drafts, applied } = usePlaybookStore.getState()
    const expected = { ...defaultParameters(BULLISH_QML_REVERSAL), rr: 3 }
    expect(drafts['bullish-qml-reversal']).toEqual(expected)
    expect(applied['bullish-qml-reversal']).toEqual(expected)
  })

  it('reports a draft dirty only when it differs from applied', () => {
    const s = usePlaybookStore.getState()
    const defaults = defaultParameters(BULLISH_QML_REVERSAL)
    s.setDraft('bullish-qml-reversal', defaults)
    s.applyDraft('bullish-qml-reversal', BULLISH_QML_REVERSAL)

    expect(isDraftDirty(usePlaybookStore.getState(), 'bullish-qml-reversal')).toBe(false)

    usePlaybookStore.getState().updateParameter('bullish-qml-reversal', 'minScore', 70)
    expect(isDraftDirty(usePlaybookStore.getState(), 'bullish-qml-reversal')).toBe(true)
  })

  it('reports an unsaved draft as dirty', () => {
    const s = usePlaybookStore.getState()
    s.setDraft('bullish-qml-reversal', defaultParameters(BULLISH_QML_REVERSAL))
    expect(isDraftDirty(usePlaybookStore.getState(), 'bullish-qml-reversal')).toBe(true)
  })

  it('tracks dirty state independently per playbook', () => {
    const s = usePlaybookStore.getState()
    s.setDraft('bullish-qml-reversal', defaultParameters(BULLISH_QML_REVERSAL))
    s.applyDraft('bullish-qml-reversal', BULLISH_QML_REVERSAL)
    s.setDraft('bearish-continuation', { ...defaultParameters(BEARISH_CONTINUATION), rr: 4 })

    const state = usePlaybookStore.getState()
    expect(isDraftDirty(state, 'bullish-qml-reversal')).toBe(false)
    expect(isDraftDirty(state, 'bearish-continuation')).toBe(true)
  })

  it('partializes only the persisted slice', () => {
    const state = usePlaybookStore.getState()
    const partial = partializePlaybookState(state)
    expect(Object.keys(partial)).toEqual(['selectedPlaybookId', 'drafts', 'applied'])
  })
})
