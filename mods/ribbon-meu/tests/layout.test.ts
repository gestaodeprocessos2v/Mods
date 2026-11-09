import { expect, test } from 'claude-code/testing'

const NOW = Date.parse('2026-11-09T12:00:00Z')

const band = (bodyColumns: number) => ({
  plugin: 'ribbon-meu',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false, isCollapsed: false, isWorking: false, maxRows: 40, bodyColumns,
    scroll: { offset: 0, bodyRows: 40 }, view: {},
  },
}) as const

// Os números do print em que a faixa cortava "restam 60m" e o botão.
for (const c of [
  { cols: 150, ownRow: false },
  { cols: 110, ownRow: true },
  { cols: 60, ownRow: true },
] as const) {
  test(`com ${c.cols} colunas o cache ${c.ownRow ? 'vai para a linha de baixo' : 'fica na mesma linha'}`, async ($, on) => {
    on('session.usage', () => ({
      value: {
        startedAt: 0,
        context: { tokens: 98_000, window: 1_000_000 },
        rateLimits: [
          { kind: 'five_hour', percentUsed: 31, resetsAt: new Date(NOW + 215 * 60000).toISOString() },
          { kind: 'seven_day', percentUsed: 30, resetsAt: new Date(NOW + 315 * 60000).toISOString() },
        ],
      },
    }))
    on('session.model', () => ({ value: 'claude-opus-5-5' }))
    on('session.start', (_, e) => ({ cwd: e.cwd }))
    on('classic.SessionStart', () => ({}))
    on('clock.every', () => ({ value: undefined }))
    on('clock.now', () => ({ value: NOW }))
    await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
    await $.classic.SessionStart({ source: 'resume', seconds_since_last_response: 30, model: 'claude-opus-5-5', context_tokens: 98_000 } as never)

    const ui = await $.ui.mount({ ...band(c.cols), surface: 'desktop' })
    const drawn = JSON.stringify(await ui.drawn())
    expect(drawn.includes('"key":"cache"')).toBe(c.ownRow)
    expect(await ui.find({ type: 'Text', text: / restam 60m/ })).toBeDefined()
    expect(await ui.find({ type: 'Button', key: 'cache-fold' })).toBeDefined()
    await ui.unmount()
  })
}
