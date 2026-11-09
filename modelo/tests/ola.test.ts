import { expect, test } from 'claude-code/testing'

test('o comando /ola responde com uma saudação', async ($, on) => {
  // Nada fica abaixo do mod no teste: estes hooks fazem o papel do Claude Code.
  on('command.register', () => ({ value: { command: 'ola' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('ui.toast', () => ({ value: undefined }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const result = await $.command.run({ command: 'ola', args: '' })

  expect(result.text).toBe('Olá! O mod modelo está funcionando.')
})
