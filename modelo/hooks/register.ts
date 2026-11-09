import type { Register } from 'claude-code'

export const register: Register = on => {
  // Registra o comando /ola ao iniciar a sessão
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'ola',
      description: 'Mostra uma saudação do mod modelo',
    })

    return next(e)
  })

  // Responde ao comando /ola
  on('command.run', { command: 'ola' }, async $ => {
    $.ui.toast(`Olá do mod ${$.plugin.name}!`)

    return { text: `Olá! O mod ${$.plugin.name} está funcionando.` }
  })
}
