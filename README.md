# Mods do Claude Code

Marketplace pessoal com os meus mods (plugins) para o [Claude Code](https://code.claude.com).
Todos os mods ficam neste repositório, cada um em sua própria pasta dentro de `mods/`.

## Instalar um mod

No prompt do Claude Code (terminal), por exemplo para o `ribbon-pt`:

```
/plugin install ribbon-pt --marketplace gestaodeprocessos2v/mods
```

Para qualquer outro mod, troque pelo nome dele:

```
/plugin install <nome-do-mod> --marketplace gestaodeprocessos2v/mods
```

Responda `y` para adicionar o marketplace e escolha o escopo (Enter = usuário).

Pelo shell:

```bash
claude plugin install <nome-do-mod> --marketplace gestaodeprocessos2v/mods
```

No app desktop: clique em **+** ao lado da caixa de prompt → **Plugins** → **Add marketplace** com `gestaodeprocessos2v/mods` → **Add plugin**.

> Se o repositório for privado, só instala quem tem acesso de leitura a ele no GitHub e uma
> credencial do git configurada no computador (chave SSH, ou `gh auth login` + `gh auth setup-git`).

## Estrutura

```
.claude-plugin/
└── marketplace.json          # Lista de mods publicados neste marketplace
mods/
└── <nome-do-mod>/            # Um mod por pasta
    ├── .claude-plugin/
    │   └── plugin.json       # Nome, versão e descrição do mod
    ├── hooks/
    │   ├── hooks.json        # Aponta para o módulo de hooks
    │   └── register.ts       # Código do mod (.ts ou .tsx)
    ├── tests/                # Testes (*.test.ts), opcional
    └── README.md             # O que o mod faz
modelo/                       # Modelo para criar um mod novo (não é publicado)
```

## Criar um mod novo

1. Copie o modelo:
   ```bash
   cp -r modelo mods/<nome-do-mod>
   ```
   O nome usa letras minúsculas, números e hífens.
2. Em `mods/<nome-do-mod>/.claude-plugin/plugin.json`, troque `name` e `description`.
3. Escreva o código em `hooks/register.ts`.
4. Valide e teste:
   ```bash
   claude plugin validate mods/<nome-do-mod>
   ```
   ```bash
   claude plugin test mods/<nome-do-mod>
   ```
5. Experimente numa sessão (recarrega sozinho a cada alteração salva):
   ```bash
   claude --plugin-dir mods/<nome-do-mod>
   ```
6. Adicione o mod em `.claude-plugin/marketplace.json`:
   ```json
   { "name": "<nome-do-mod>", "source": "./mods/<nome-do-mod>" }
   ```
7. Adicione uma linha no índice abaixo e faça commit.

Para publicar uma nova versão de um mod, aumente `version` no `plugin.json`.
Quem já instalou atualiza com `claude plugin update <nome-do-mod>`.

## Índice de mods

| Mod | Descrição | Versão |
|-----|-----------|--------|
| [ribbon-pt](mods/ribbon-pt) | Faixa acima do prompt com o uso das janelas de 5h e 7 dias, quando renovam, e se o cache está quente ou frio com o custo da próxima mensagem | 1.0.4 |
