# Robô Peão: product design

## Problema

Quem roda vários agentes do Claude Code ao mesmo tempo (terminal, VS Code, app desktop) perde a noção de quem está trabalhando, quem terminou e quem está parado esperando aprovação. A informação existe, mas está espalhada em janelas diferentes.

## Proposta

Um botão flutuante, sempre no topo da tela, com um robô por agente. Bateu o olho, sabe o estado de tudo. Clicou, vê o que cada um está fazendo agora, incluindo os subagentes.

## Público

Dev ou criador que usa Claude Code com vários agentes e subagentes em paralelo. Plataforma testada: Windows 11.

## Princípios

1. **Ver sem procurar.** O estado geral cabe no botão fechado: quantos rodando, quantos esperando você.
2. **Só interromper quando precisa.** Notificação do sistema apenas quando um agente termina ou pede aprovação.
3. **Nunca atrapalhar o Claude Code.** Widget fechado ou travado = Claude Code segue normal.
4. **Personalidade com função.** Cada robô é um personagem fixo por sessão, pra reconhecer o agente pela cara.

## Personagens

| Robô | Material | Uso |
|---|---|---|
| Atlas | cromado, viseira azul, faixa laranja | sessão |
| Cora | cerâmica branca, lente dourada | sessão |
| Bronze | latão retrô, olhos âmbar | sessão |
| Grafite | metal escuro, óculos, gravata | sessão |
| Drone | esfera de cobre, um olho | subagente; cor do olho = status |

Cada sessão recebe um dos 4 robôs de forma determinística (hash do `session_id`).

## Estados

O status aparece em três lugares ao mesmo tempo: selo no canto do robô, cor dos olhos e texto. Nada de azul: some no fundo azul-marinho.

| Estado | Quando | Selo | Olhos | Texto |
|---|---|---|---|---|
| trabalhando | depois de um prompt ou ferramenta | anel branco girando | brancos | ação atual ("Edit auth.ts") |
| precisa de você | pedido de permissão | **!** laranja pulsando; painel abre sozinho | laranja | "Precisa de você: …" + Aprovar/Negar |
| pronto | evento `Stop` sem drone trabalhando, você ainda não viu | **✓** verde | verdes | "Pronto · terminou há X" |
| parado | já viu o "pronto" (fechou o painel) ou sessão sem pedido | nenhum | apagados | "Parado" |

Fechar o painel marca todos os "pronto" como vistos (viram "parado"), como mensagem lida.
O botão flutuante resume em palavras só o que existe: "1 precisa de você · 2 trabalhando · 1 pronto".

Subagente: trabalhando (olho branco) → pronto (olho verde). Com a linha fechada, os drones trabalhando aparecem embaixo do status ("2 drones trabalhando"). O drone nasce no primeiro evento que traz `agent_id` (não depende do `SubagentStart`), volta a "trabalhando" se agir depois do `Stop` do agente principal (subagente em segundo plano) e os prontos somem no próximo pedido. Enquanto houver drone trabalhando, o agente não fica "pronto": mostra "Esperando os drones…" e só termina (com notificação) quando o último drone acaba.

## Telas

- **Botão fechado**: cabeças dos robôs com ponto de status, "N trabalhando", "N esperando você". Arrastável. Ao passar o mouse, mostra silenciar notificações (sino; lembrado entre aberturas), minimizar (–) e fechar (×).
- **Minimizado**: o widget some; fica só o ícone (robô Atlas) na área de notificação, ao lado do relógio. Clique alterna mostrar/esconder; botão direito: Mostrar, Minimizar, Sair. Clicar numa notificação também traz o widget de volta.
- **Painel aberto**: uma linha por sessão (robô, nome, projeto, ação atual, progresso quando houver). Clique na linha expande subagentes e pedido de aprovação.
- **Notificação do sistema**: término e pedido de aprovação.

Referência visual: `docs/images/` (gerado por `npm run screenshots`).

## Fontes de dados (hooks do Claude Code)

| Evento | Uso |
|---|---|
| `SessionStart` / `SessionEnd` | cria / remove a sessão |
| `UserPromptSubmit` | marca rodando |
| `PreToolUse` / `PostToolUse` | ação atual ("Edit auth.ts"); com `agent_id`, vai pro subagente |
| `PermissionRequest` | esperando você; o relay segura a resposta até o clique (ou timeout) |
| `Notification` (`permission_prompt`) | esperando você |
| `SubagentStart` / `SubagentStop` | drones |
| `Stop` | terminou |

Progresso X/Y vem da lista de tarefas do agente (`TodoWrite`), quando ele usa uma. Não existe evento de progresso oficial.

## Decisões

- **Electron** em vez de Tauri: Rust não está instalado; Electron roda só com Node.
- **Hooks em vez de ler transcripts**: os hooks são API documentada; o formato dos `.jsonl` é interno e muda.
- **Aprovação com fallback**: se o widget não responde em 60 s, o relay devolve vazio e o Claude Code segue o fluxo normal.
- **Opções de aprovação** (só o que o hook `PermissionRequest` aceita): Aprovar; Sempre permitir (devolve as `permission_suggestions` em `updatedPermissions`, só aparece quando o Claude Code sugere uma regra); Negar; Negar dizendo o que fazer (vai como `message`). Perguntas ao usuário (`AskUserQuestion`, `ExitPlanMode`) não ganham botões: o widget só avisa e o Claude Code mostra o diálogo dele.
- **Painel expandido**: pasta, tempo trabalhando, últimas 6 ações do pedido atual e subagentes.
- **Settings do usuário** (`~/.claude/settings.json`): vale pra terminal, VS Code e desktop de uma vez.

## Limites conhecidos

- Sessões na nuvem não leem o settings local: ficam de fora.
- VS Code: a doc confirma que carrega hooks do usuário, mas não confirma subagentes lá. Validar.
- App desktop usa binário próprio do Claude Code; eventos novos podem chegar depois.
- Cada evento de ferramenta abre um processo Node (~50–100 ms no Windows).
- Sessão que morre sem `SessionEnd` fica "terminou" até ser limpa (limpeza após 30 min sem eventos).

## Roadmap

1. **MVP** (agora): terminal, estados, subagentes, notificações, aprovar/negar.
2. Validar VS Code e app desktop.
3. Lembrar a posição do botão entre aberturas (arrastar já funciona).
4. Clicar no agente foca a janela/terminal dele.
5. ~~Iniciar junto com o Windows~~ (feito: ligado na primeira execução; desliga pelo menu do ícone).
6. Robôs em render 3D de verdade (imagens) no lugar dos SVGs.
7. Suporte ao Codex.
8. Temas prontos para escolher (anime, RPG, animais...), feitos pela comunidade.
