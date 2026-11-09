import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { CacheFacts, Ctx, Fold, Window } from '../types'
import {
  BG, HUE, INK, MUTED, ORANGE, ROBO_SIZE, TEXT, TTL_MIN, TTL_MS, WORD,
  bandPx, cardSvg, chipSvg, fmtIdle, kindOf, roboSvg, tok,
} from './cache-art'
import type { CacheView } from './cache-art'

// A band above the prompt in a warm dark look: card surface, cream text.
// Shows how much of each usage window is USED, 5-hour first, then 7-day; each
// window is green up to 50% used, orange up to 75%, red above; a window with
// under 15% left adds a bold ALTO. Then CTX, the share of the context window in
// use: green under 60%, orange from 60% to under 80%, red from 80%.
//
// After the first reply it also shows the prompt cache: WARM (red, Robo bobbing)
// for an hour after the last request, then COLD (blue, Robo frozen) with the
// tokens the next message re-caches. Hide / Show folds the card; warm starts folded,
// cold starts open, and a choice holds until the cache flips. Zero token cost:
// it reads the engine's own figures and draws.

const LOW_AT = 15
/** How often the band redraws, so the countdown and the warm-to-cold flip stay current. */
const TICK_MS = 30_000

const windows = atom({ plugin: 'ribbon-meu', key: 'windows' } as const, [] as Window[])
const cache = atom({ plugin: 'ribbon-meu', key: 'cache' } as const, null as CacheFacts | null)
const fold = atom({ plugin: 'ribbon-meu', key: 'fold' } as const, null as Fold | null)
const ctx = atom({ plugin: 'ribbon-meu', key: 'ctx' } as const, null as Ctx | null)

const NAMES: Record<string, string> = { seven_day: '7D', five_hour: '5H', spend_limit: 'GASTO' }
const ORDER: Record<string, number> = { five_hour: 0, seven_day: 1 }
const GREEN = '#5fb36b'
const RED = '#e5484d'
/** A window's colour by how much of it is used: green to 50%, orange to 75%, red above. */
const colorOf = (used: number): string => (used <= 50 ? GREEN : used <= 75 ? ORANGE : RED)
/** The context's colour by share used: green under 60%, orange from 60% to under 80%, red from 80%. */
export const ctxColorOf = (pct: number): string => (pct < 60 ? GREEN : pct < 80 ? ORANGE : RED)

/** The share of the context window in use, 0 to 100, or null while it is unknown. */
export const ctxPct = (c: Ctx | null): number | null =>
  c && c.window > 0 && c.tokens > 0 ? Math.min(100, (c.tokens / c.window) * 100) : null

const clean = (list: readonly Window[]): Window[] =>
  list
    .map(w => ({ kind: w.kind, percentUsed: w.percentUsed, resetsAt: w.resetsAt }))
    .sort((a, b) => (ORDER[a.kind] ?? 9) - (ORDER[b.kind] ?? 9))

/** The context figures from a usage reading, keeping the last known ones where it has none. */
const nextCtx = (u: { tokens?: number; window: number }, c: Ctx | null): Ctx | null => {
  const tokens = u.tokens && u.tokens > 0 ? u.tokens : (c?.tokens ?? 0)
  const window = u.window || c?.window || 0
  return tokens > 0 && window > 0 ? { tokens, window } : c
}

const fmtReset = (iso: string | undefined, now: number): string => {
  if (!iso) return ''
  const ms = Date.parse(iso) - now
  if (Number.isNaN(ms)) return ''
  if (ms <= 0) return 'renovando'
  const mins = Math.round(ms / 60000)
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ${mins % 60}m`
  return `${Math.floor(hours / 24)}d ${hours % 24}h`
}

/** What the cache drawings read, or null until a request and its context size are known. */
export const viewOf = (c: CacheFacts | null, now: number): CacheView | null => {
  if (!c || c.lastAt <= 0 || c.tokens <= 0) return null
  const idleMs = Math.max(0, now - c.lastAt)
  return {
    mode: idleMs >= TTL_MS ? 'cold' : 'warm',
    idle: fmtIdle(idleMs),
    idleMin: Math.floor(idleMs / 60000),
    tokens: c.tokens,
    window: c.window,
  }
}

const pull = async ($: EngineInterface): Promise<void> => {
  const u = await $.session.usage()
  await update($, windows, () => clean(u.rateLimits))
  await update($, ctx, c => nextCtx(u.context, c))
}

/** Fresh context figures from the engine onto the cache facts, when it has them. */
const measure = async ($: EngineInterface, lastAt: number | null, model: string | null): Promise<void> => {
  const u = await $.session.usage()
  const m = model ?? (await $.session.model())
  await update($, ctx, c => nextCtx(u.context, c))
  await update($, cache, c => ({
    lastAt: lastAt ?? c?.lastAt ?? 0,
    tokens: u.context.tokens && u.context.tokens > 0 ? u.context.tokens : (c?.tokens ?? 0),
    window: u.context.window || c?.window || 0,
    model: m || c?.model || null,
  }))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await pull($)
    $.clock.every(TICK_MS, () => $.ui.invalidate('ui.render'))
    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('rateLimits')) {
      await update($, windows, () => clean(e.rateLimits))
    }
    if (e.changed.includes('context')) {
      await update($, ctx, c => nextCtx(e.context, c))
    }
    if (e.changed.includes('context') && e.context.tokens && e.context.tokens > 0) {
      const tokens = e.context.tokens
      await update($, cache, c => (c ? { ...c, tokens, window: e.context.window || c.window } : c))
    }
    return next(e)
  })

  // A resumed or forked session knows how long it was away and how big it is.
  on('classic.SessionStart', async ($, e, next) => {
    const r = await next(e)
    if (e.source === 'clear' || e.source === 'compact') {
      await update($, cache, () => null)
      await update($, fold, () => null)
      await update($, ctx, () => null)
    } else if ((e.source === 'resume' || e.source === 'fork') && typeof e.seconds_since_last_response === 'number') {
      const now = await $.clock.now()
      const lastAt = now - e.seconds_since_last_response * 1000
      const window = (await $.session.usage()).context.window
      const model = typeof e.model === 'string' ? e.model : await $.session.model()
      const tokens = typeof e.context_tokens === 'number' ? e.context_tokens : 0
      await update($, cache, () => ({ lastAt, tokens, window, model }))
    }
    return r
  }).catch(($, e, next) => next(e)) // a band that fails to seed never holds up the session

  // Each main-thread request reads or writes the cache, so its start resets the hour.
  on('turn.step', async function* ($, e, next) {
    if (!e.agentId) {
      const now = await $.clock.now()
      await update($, cache, c => ({ lastAt: now, tokens: c?.tokens ?? 0, window: c?.window ?? 0, model: c?.model ?? null }))
    }
    yield* next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    if (e.agentId) return r
    const now = await $.clock.now()
    const c = await read($, cache)
    // turn.step stamps the exact request time; when no step of this turn did, the turn's end is the floor.
    const lastAt = !c || now - c.lastAt > e.durationMs ? now : c.lastAt
    await measure($, lastAt, e.usage?.model ?? null)
    return r
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)

    const ui = $.ui.resolve(e)
    const { Box, Button, Text } = ui
    // Svg draws on desktop, mobile and VS Code; the terminal gets the text form.
    // Ask the surface, not the table: the terminal's table still lists Svg.
    const Svg = e.surface !== 'terminal' && 'Svg' in ui ? ui.Svg : null
    const list = await read($, windows)
    const now = await $.clock.now()
    const view = viewOf(await read($, cache), now)
    const context = await read($, ctx)
    const pct = ctxPct(context)

    if (list.length === 0 && !view && pct === null) {
      return (
        <Box backgroundColor={BG} paddingX={1}>
          <Text color={MUTED}>USO · aguardando a primeira resposta</Text>
        </Box>
      )
    }

    const columns = e.props.bodyColumns ?? e.viewport?.columns ?? 100
    // The card's own layout still follows the width alone.
    const kind = kindOf(columns)

    const parts = (w: Window) => {
      const used = Math.min(100, Math.max(0, Math.round(w.percentUsed * 10) / 10))
      return {
        used,
        left: 100 - used,
        col: colorOf(used),
        name: NAMES[w.kind] ?? w.kind.toUpperCase(),
        reset: fmtReset(w.resetsAt, now),
      }
    }

    const ctxParts = pct !== null && context
      ? { shown: Math.round(pct * 10) / 10, col: ctxColorOf(pct), size: `${tok(context.tokens)} de ${tok(context.window)}` }
      : null

    // How many cells the usage row takes with every item on one line: label,
    // windows and CTX, each with its margin, plus the row's padding.
    const windowCells = (w: Window): number => {
      const p = parts(w)
      return p.name.length + 1 + `${p.used}% usado`.length + (p.left < LOW_AT ? 5 : 0) + (p.reset ? 3 + p.reset.length : 0) + 3
    }
    const usageCells =
      2 + 5 +
      (list.length > 0 ? list.reduce((n, w) => n + windowCells(w), 0) : 33) +
      (ctxParts ? `CTX ${ctxParts.shown}% usado · ${ctxParts.size}`.length + 3 : 0)
    /** Room kept free so a slightly wider font or a longer figure does not clip. */
    const SLACK = 4
    const usageFits = usageCells + SLACK <= columns

    // Inline: each item on one line (name, percent, reset). Block: three lines.
    const wide = (w: Window, i: number) => {
      const p = parts(w)
      return (
        <Box key={`w-${i}`} flexDirection="row" flexShrink={0} marginRight={3}>
          <Text color={MUTED} bold>{p.name} </Text>
          <Text color={p.col} bold>{p.used}% usado</Text>
          {p.left < LOW_AT ? <Text color={TEXT} bold> ALTO</Text> : null}
          {p.reset ? <Text color={MUTED}> · {p.reset}</Text> : null}
        </Box>
      )
    }

    const stacked = (w: Window, i: number) => {
      const p = parts(w)
      return (
        <Box key={`w-${i}`} flexDirection="column" flexShrink={0} marginRight={3}>
          <Text color={MUTED} bold>{p.name}</Text>
          <Box flexDirection="row">
            <Text color={p.col} bold>{p.used}% usado</Text>
            {p.left < LOW_AT ? <Text color={TEXT} bold> ALTO</Text> : null}
          </Box>
          {p.reset ? <Text color={MUTED}>renova em {p.reset}</Text> : null}
        </Box>
      )
    }

    // The context indicator, in the same shape as a window.
    const contextItem = !ctxParts
      ? null
      : usageFits ? (
        <Box key="ctx" flexDirection="row" flexShrink={0} marginRight={3}>
          <Text color={MUTED} bold>CTX </Text>
          <Text color={ctxParts.col} bold>{ctxParts.shown}% usado</Text>
          <Text color={MUTED}> · {ctxParts.size}</Text>
        </Box>
      ) : (
        <Box key="ctx" flexDirection="column" flexShrink={0} marginRight={3}>
          <Text color={MUTED} bold>CTX</Text>
          <Text color={ctxParts.col} bold>{ctxParts.shown}% usado</Text>
          <Text color={MUTED}>{ctxParts.size}</Text>
        </Box>
      )

    const label = (
      <Box key="label" flexShrink={0} marginRight={2}>
        <Text color={TEXT} bold>USO</Text>
      </Box>
    )
    const usage = [
      ...(list.length > 0
        ? list.map(usageFits ? wide : stacked)
        : [<Box key="wait" flexShrink={0} marginRight={3}><Text color={MUTED}>aguardando a primeira resposta</Text></Box>]),
      ...(contextItem ? [contextItem] : []),
    ]
    // Wraps rather than clips where the estimate falls short.
    const usageRow = (
      <Box key="row" flexDirection="row" flexWrap="wrap" paddingX={1}>
        {label}
        {usage}
      </Box>
    )

    // Before the first reply there is no cache to show.
    if (!view) {
      return (
        <Box flexDirection="column" backgroundColor={BG}>
          {usageRow}
        </Box>
      )
    }

    const mode = view.mode
    const cold = mode === 'cold'
    const hue = HUE[mode]
    const stored = await read($, fold)
    // Folding needs the card, and the card is a drawing: the terminal stays folded.
    const open = Svg !== null && (stored && stored.mode === mode ? stored.open : cold)
    const toggle = () =>
      update($, fold, f => ({ mode, open: !(f && f.mode === mode ? f.open : mode === 'cold') }))

    const chip = chipSvg(mode)
    const badge = Svg
      ? [
          <Svg key="robo" source={roboSvg(mode)} alt={cold ? 'Robo, congelado' : 'Robo, saltitando'} width={ROBO_SIZE} height={ROBO_SIZE} isInteractive />,
          <Text key="gap"> </Text>,
          <Svg key="chip" source={chip.source} alt={WORD[mode]} width={chip.w} height={chip.h} />,
        ]
      : [<Text key="chip" backgroundColor={hue} color={INK} bold>{` ${WORD[mode]} `}</Text>]

    const idleText = ` ${view.idle}`
    const leftText = ` restam ${Math.max(0, TTL_MIN - view.idleMin)}m`
    const summary = cold
      ? [
          <Text key="idle" color={hue} bold>{idleText}</Text>,
          <Text key="dot" color={MUTED}> · </Text>,
          <Text key="tokens" color={TEXT} bold>{tok(view.tokens)}</Text>,
          <Text key="what" color={MUTED}> tokens a recachear</Text>,
        ]
      : [<Text key="left" color={hue} bold>{leftText}</Text>]

    const buttonLabel = open ? 'Ocultar' : 'Mostrar'
    const button = Svg ? (
      <Box key="fold" flexShrink={0} alignItems="flex-start">
        <Button key="cache-fold" label={buttonLabel} onPress={toggle} />
      </Box>
    ) : null
    const grow = <Box key="grow" flexGrow={1} />

    // Cells the cache summary and the button add to the row (a drawing counted
    // at the 12 px a cell takes).
    const badgeCells = Svg ? Math.ceil(ROBO_SIZE / 12) + 1 + Math.ceil(chip.w / 12) : WORD[mode].length + 2
    const summaryCells = cold ? idleText.length + 3 + tok(view.tokens).length + 19 : leftText.length
    const cacheCells = open ? 0 : badgeCells + summaryCells + 2
    const buttonCells = Svg ? buttonLabel.length + 4 : 0

    let rows
    if (usageFits && usageCells + cacheCells + buttonCells + SLACK <= columns) {
      // Everything on one row.
      rows = (
        <Box key="row" flexDirection="row" paddingX={1} alignItems="center">
          {label}
          {usage}
          {open ? null : (
            <Box key="inline" flexDirection="row" flexShrink={0} marginRight={2} alignItems="center">
              {badge}
              {summary}
            </Box>
          )}
          {grow}
          {button}
        </Box>
      )
    } else {
      // The cache gets its own row under the usage.
      rows = [
        usageRow,
        <Box key="cache" flexDirection="row" paddingX={1} alignItems="center">
          {badge}
          {summary}
          {grow}
          {button}
        </Box>,
      ]
    }

    let card = null
    if (open && Svg) {
      const c = cardSvg(view, kind, bandPx(columns))
      card = (
        <Box key="card" flexDirection="row">
          <Svg source={c.source} alt={c.alt} width={c.w} height={c.h} isInteractive={kind !== 'tight'} />
        </Box>
      )
    }

    return (
      <Box flexDirection="column" backgroundColor={BG}>
        {rows}
        {card}
      </Box>
    )
  })
}
