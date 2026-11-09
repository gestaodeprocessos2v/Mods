# ribbon-meu

Versão personalizada do [ribbon-pt](../ribbon-pt), que é a tradução para o português do
[ribbon](https://github.com/robonuggets/ribbon), de Jay E (RoboNuggets), sob licença MIT.

Mostra uma faixa acima do prompt com o uso das janelas de 5 horas e 7 dias, quando cada uma
renova, quanto do contexto já foi consumido, e se o cache do prompt está quente ou frio, com o
custo da próxima mensagem.

> Não instale junto com o `ribbon-pt`: os dois desenham a mesma faixa e ela apareceria duas vezes.

## Instalação

```
/plugin install ribbon-meu --marketplace gestaodeprocessos2v/mods
```

## Mudanças em relação ao ribbon-pt

### 0.2.0
- Removidas as barras de bolinhas (●●●···) das janelas 5H e 7D; fica só o percentual.
- Novo indicador **CTX**: percentual do contexto consumido e tokens usados de tokens da janela
  (ex.: `CTX 45% usado · 90k de 200k`). Cores: verde abaixo de 60%, laranja de 60% a menos de 80%,
  vermelho a partir de 80%.

## Créditos

- Mod original: [robonuggets/ribbon](https://github.com/robonuggets/ribbon) — MIT (ver `LICENSE`).
- Fonte Outfit — SIL Open Font License 1.1.
