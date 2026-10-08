# Como contribuir com o Robô Peão

Valeu por querer ajudar! Toda contribuição conta: uma fala nova, um tema, um bug corrigido ou só uma ideia.

## Só tenho uma ideia ou achei um problema

Abra uma [issue](https://github.com/daniel-cutrim/robo-peao/issues/new) contando:

- **Ideia:** o que você queria que o Robô Peão fizesse e por quê.
- **Problema:** o que você fez, o que esperava e o que aconteceu. Diga seu sistema (Windows, macOS, Linux) e onde roda o Claude Code (terminal, VS Code, app desktop). Se puder, anexe o `events.log` da pasta de dados do app (ele não guarda comandos nem conteúdo de arquivos).

Prefere conversar? Me chama no Instagram [@elcutrim](https://instagram.com/elcutrim) ou no [LinkedIn](https://www.linkedin.com/in/daniel-cutrim).

## Quero mexer no código

Nunca mandou um pull request? É assim:

1. **Fork**: no topo da página do repositório, clique em **Fork**. Isso cria uma cópia do projeto na sua conta.
2. **Clone a sua cópia** e instale:
   ```bash
   git clone https://github.com/SEU-USUARIO/robo-peao.git
   cd robo-peao
   npm install
   ```
3. **Crie um branch** com um nome que diga o que você vai fazer:
   ```bash
   git checkout -b tema-anime
   ```
4. **Faça a mudança** e teste:
   ```bash
   npm test     # a lógica de estado continua funcionando?
   npm start    # abre o widget pra você ver
   ```
   Mudou algo visível? Rode `npm run screenshots` pra atualizar as imagens do README.
5. **Commit e push** pra sua cópia:
   ```bash
   git add .
   git commit -m "feat: tema de anime"
   git push origin tema-anime
   ```
6. **Abra o pull request**: volte na página do seu fork no GitHub; vai aparecer um botão **Compare & pull request**. Explique o que mudou e, se for visual, cole um print.

Eu reviso, a gente conversa se precisar ajustar e, quando estiver ok, entra no projeto.

## Combinados

- **Commits** no formato `tipo: descrição` (`feat:`, `fix:`, `docs:`, `refactor:`), em português ou inglês.
- **Um assunto por pull request.** Tema novo e correção de bug em PRs separados.
- **Segurança em primeiro lugar.** Não remova a senha do servidor local nem o tratamento do texto que vem dos hooks antes de ir pra tela. Detalhes no [`CLAUDE.md`](CLAUDE.md).
- **Falas e temas** com humor, sem ofender pessoas ou grupos.
- **Tudo local.** O widget não faz chamadas pra internet, e é pra continuar assim.

## Onde fica cada coisa

| Pasta/arquivo | O que é |
|---|---|
| `app/state.js` | eventos do Claude Code → estado do widget (tem testes em `state.test.js`) |
| `app/main.js` | janela, servidor local, notificações, ícone da bandeja |
| `app/renderer/` | interface: `app.js` (lógica), `robots.js` (personagens), `falas.js`, `style.css` |
| `hooks/relay.mjs` | o script que os hooks do Claude Code chamam |
| `scripts/` | instalador dos hooks e gerador das imagens do README |
| `docs/PRODUCT.md` | visão do produto, decisões e roadmap |
