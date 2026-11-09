# Repositório de mods do Claude Code

Este repositório é um marketplace de plugins (mods) do Claude Code.

## Convenções

- Cada mod fica em `mods/<nome>/`, com `.claude-plugin/plugin.json`, `hooks/hooks.json` e `hooks/register.ts` (ou `.tsx`).
- O nome do mod (pasta e `name` no `plugin.json`) usa apenas letras minúsculas, números e hífens.
- Um mod novo começa como cópia de `modelo/`. A pasta `modelo/` não entra no marketplace.
- Ao criar ou renomear um mod, atualize `.claude-plugin/marketplace.json` (`"source": "./mods/<nome>"`) e o índice do `README.md`.
- Ao alterar um mod já publicado, aumente `version` no `plugin.json`.
- Antes de fazer commit, rode `claude plugin validate mods/<nome>` e, se o mod tiver testes, `claude plugin test mods/<nome>`.
- Textos de documentação em português.
