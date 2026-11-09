import { expect, test } from 'claude-code/testing'

const GREEN = '#5fb36b'
const ORANGE = '#ff6b1a'
const RED = '#e5484d'

const BAND = {
  plugin: 'ribbon-meu',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isCollapsed: false,
    isWorking: false,
    maxRows: 20,
    bodyColumns: 120,
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

const CASES = [
  { tokens: 100_000, pct: '50% usado', color: GREEN },
  { tokens: 119_800, pct: '59.9% usado', color: GREEN },
  { tokens: 120_000, pct: '60% usado', color: ORANGE },
  { tokens: 159_800, pct: '79.9% usado', color: ORANGE },
  { tokens: 160_000, pct: '80% usado', color: RED },
] as const

for (const c of CASES) {
  test(`contexto em ${c.pct} fica na cor certa, sem bolinhas`, async ($, on) => {
    on('session.usage', () => ({
      value: {
        startedAt: 0,
        context: { tokens: c.tokens, window: 200_000 },
        rateLimits: [{ kind: 'five_hour', percentUsed: 42 }],
      },
    }))
    on('session.start', (_, e) => ({ cwd: e.cwd }))
    on('clock.every', () => ({ value: undefined }))
    on('clock.now', () => ({ value: Date.parse('2026-11-09T12:00:00Z') }))

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

    for (const surface of ['terminal', 'desktop'] as const) {
      const ui = await $.ui.mount({ ...BAND, surface })
      const ctx = await ui.find({ type: 'Text', text: c.pct })
      expect(ctx).toBeDefined()
      expect(JSON.stringify(ctx)).toContain(c.color)
      expect(await ui.find({ type: 'Text', text: /CTX/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /●/ })).toBeUndefined()
      await ui.unmount()
    }
  })
}
