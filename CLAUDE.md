# Robô Peão

Widget flutuante (sempre no topo) que mostra os agentes e subagentes do Claude Code rodando, com robôs metálicos como personagens. Funciona com sessões do terminal, extensão do VS Code e aba Code do app desktop, via hooks do Claude Code.

Visão de produto e decisões: `docs/PRODUCT.md`. Leia antes de mudar comportamento.

## Como funciona

```
Claude Code ──hooks──► hooks/relay.mjs ──POST──► app/main.js (servidor 127.0.0.1:47821)
                                                     │ app/state.js (estado puro)
                                                     ▼
                                              app/renderer (janela transparente)
```

- `hooks/relay.mjs`: chamado pelo Claude Code a cada evento. Lê o JSON do stdin e repassa pro widget. **Nunca pode quebrar o Claude Code**: qualquer erro → sai com código 0 sem output.
- `app/state.js`: toda a lógica de eventos → estado. Sem Electron, testável com `node --test`.
- `app/main.js`: Electron + servidor HTTP local + notificações do sistema.
- `app/renderer/`: HTML/CSS/JS puro, sem framework. `robots.js` desenha os robôs em SVG.
- `scripts/install-hooks.mjs`: registra os hooks em `~/.claude/settings.json` (dry-run por padrão).

## Comandos

- `npm install`: instala o Electron
- `npm start`: abre o widget
- `npm test`: testa `app/state.js`
- `node scripts/install-hooks.mjs`: mostra o que seria adicionado ao settings (não grava)
- `node scripts/install-hooks.mjs --apply` / `--remove`: grava / remove (faz backup antes)

## Depuração

- Log de eventos (só tipo do evento, sessão e nome da ferramenta; nunca o input): `%APPDATA%\robo-peao\events.log` (macOS: `~/Library/Application Support/robo-peao/events.log`). Mostra pedidos de permissão, cliques e timeouts.
- Teste real de aprovação sem mexer no seu terminal: numa pasta temporária, `claude -p "rode o comando X" --permission-mode default`; o `PermissionRequest` chega ao widget.

## Regras do projeto

- Texto vindo dos hooks (comandos, caminhos, prompts) é dado não confiável: no renderer, sempre escapar antes de inserir no HTML.
- O servidor escuta só em `127.0.0.1` e exige o header `x-robots-token` (senha aleatória por execução, gravada em `<userData>/token` e lida pelo relay); recusa qualquer pedido com `Origin` (vindo de navegador). Aprovar/negar só acontece por clique no widget (IPC), nunca por rota HTTP.
- As falas dos robôs ficam em `app/renderer/falas.js` (uma por linha); o ritmo (2 min) e a duração do balão (7 s) ficam no topo de `app.js`.
- Imagens do README: `npm run screenshots` (renderiza fora da tela com dados de demonstração; nunca tirar print da tela real).
- Mudou o formato de evento ou estado? Atualize `app/state.test.js`.
- Sem framework no renderer enquanto o widget couber em um arquivo de lógica.
- Janela: a posição é guardada como "âncora" (canto inferior direito); o painel cresce pra cima/esquerda e `placeWindow` puxa tudo de volta pra tela se não couber. No Windows, mudar o tamanho exige `setResizable(true)` temporário.
- Cliques no widget: ignorar `detail > 1` (o redimensionamento faz o Windows reenviar o clique como duplo) e o clique que vem logo após um arrasto.
- Se o projeto ficar numa pasta sincronizada (OneDrive, Dropbox), o `node_modules` pode atrapalhar a sincronização.
