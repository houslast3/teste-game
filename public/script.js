const socket = io();

let currentRoom = null;
let isHost = false;

// Funções de navegação entre telas
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => screen.classList.add('hidden'));
    document.getElementById(screenId).classList.remove('hidden');
}

function showInitialScreen() {
    showScreen('initial-screen');
}

function showCreateRoom() {
    showScreen('create-room');
}

function showJoinRoom() {
    showScreen('join-room');
}

// Funções de criação e entrada em sala
function createRoom() {
    const hostName = document.getElementById('host-name').value.trim();
    const questions = document.getElementById('questions').value.trim();
    
    if (!hostName || !questions) {
        alert('Por favor, preencha todos os campos');
        return;
    }

    socket.emit('createRoom', { hostName, questions });
}

function joinRoom() {
    const playerName = document.getElementById('player-name').value.trim();
    const roomCode = document.getElementById('room-code').value.trim();
    
    if (!playerName || !roomCode) {
        alert('Por favor, preencha todos os campos');
        return;
    }

    socket.emit('joinRoom', { roomCode, playerName });
}

// Funções do jogo
function startGame() {
    socket.emit('startGame', currentRoom);
}

function submitAnswer(answerIndex) {
    socket.emit('submitAnswer', { roomCode: currentRoom, answerIndex });
    document.querySelectorAll('.answer-btn').forEach(btn => {
        btn.disabled = true;
    });
}

function nextQuestion() {
    socket.emit('nextQuestion', currentRoom);
}

// Socket event listeners
socket.on('roomCreated', ({ roomCode, isHost: host }) => {
    currentRoom = roomCode;
    isHost = host;
    document.getElementById('room-code-display').textContent = `Código da sala: ${roomCode}`;
    if (isHost) {
        document.getElementById('host-controls').classList.remove('hidden');
    }
    showScreen('waiting-room');
});

socket.on('roomJoined', ({ roomCode, isHost: host }) => {
    currentRoom = roomCode;
    isHost = host;
    document.getElementById('room-code-display').textContent = `Código da sala: ${roomCode}`;
    showScreen('waiting-room');
});

socket.on('updatePlayers', (players) => {
    const playersList = document.getElementById('players-list');
    playersList.innerHTML = players
        .map(player => `<li>${player.name} - Pontos: ${player.score}</li>`)
        .join('');
});

socket.on('gameStarting', () => {
    showScreen('game-screen');
    const countdown = document.getElementById('countdown');
    countdown.classList.remove('hidden');
    let count = 3;
    countdown.textContent = count;
    
    const interval = setInterval(() => {
        count--;
        if (count > 0) {
            countdown.textContent = count;
        } else {
            clearInterval(interval);
            countdown.classList.add('hidden');
        }
    }, 1000);
});

socket.on('newQuestion', ({ question, answers }) => {
    document.getElementById('question-display').textContent = question;
    document.getElementById('result-display').classList.add('hidden');
    document.getElementById('answers-grid').classList.remove('hidden');
    
    if (isHost) {
        document.getElementById('host-next').classList.add('hidden');
    }

    answers.forEach((answer, index) => {
        const button = document.getElementById(`answer-${index}`);
        button.textContent = answer;
        button.disabled = false;
        button.onclick = () => submitAnswer(index);
    });
});

socket.on('showResults', ({ correctIndex, players }) => {
    document.getElementById('answers-grid').classList.add('hidden');
    document.getElementById('result-display').classList.remove('hidden');
    
    const correctAnswer = document.getElementById(`answer-${correctIndex}`).textContent;
    document.getElementById('correct-answer').textContent = `Resposta correta: ${correctAnswer}`;
    
    document.getElementById('scores').innerHTML = players
        .map(player => `${player.name}: ${player.score} pontos`)
        .join('<br>');
    
    if (isHost) {
        document.getElementById('host-next').classList.remove('hidden');
    }
});

socket.on('gameOver', ({ players }) => {
    showScreen('final-screen');
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
    document.getElementById('final-scores').innerHTML = sortedPlayers
        .map((player, index) => `${index + 1}º lugar - ${player.name}: ${player.score} pontos`)
        .join('<br>');
});

socket.on('error', ({ message }) => {
    alert(message);
});

socket.on('hostLeft', () => {
    alert('O host saiu da sala. O jogo foi encerrado.');
    showInitialScreen();
});
