# Quiz Multiplayer

Um jogo de quiz multiplayer em tempo real onde os jogadores podem criar salas e competir respondendo perguntas.

## Requisitos

- Node.js (versão 12 ou superior)
- NPM (Node Package Manager)

## Instalação

1. Clone este repositório ou baixe os arquivos
2. Abra o terminal na pasta do projeto
3. Execute o comando para instalar as dependências:
```bash
npm install
```

## Como Executar

1. No terminal, execute o comando:
```bash
npm start
```
2. Abra o navegador e acesse `http://localhost:3000`

## Como Jogar

### Criando uma Sala
1. Clique em "Criar Sala"
2. Digite seu nome
3. Digite as perguntas no formato:
```
pergunta1,resposta1,resposta2,$resposta3,resposta4;pergunta2,resposta1,$resposta2,resposta3,resposta4
```
Observações:
- Use vírgula (,) para separar a pergunta e as respostas
- Use cifrão ($) para marcar a resposta correta
- Use ponto e vírgula (;) para separar diferentes perguntas

### Entrando em uma Sala
1. Clique em "Entrar em Sala"
2. Digite seu nome
3. Digite o código da sala (5 números)

### Durante o Jogo
- O criador da sala pode iniciar o jogo quando todos os jogadores estiverem prontos
- Cada jogador deve selecionar uma resposta
- Após todos responderem, a resposta correta será revelada
- O criador da sala controla a passagem para a próxima pergunta
- Cada resposta correta vale 100 pontos
- No final, será mostrada a classificação dos jogadores

## Tecnologias Utilizadas

- Node.js
- Express
- Socket.IO
- HTML5
- CSS3
- JavaScript
