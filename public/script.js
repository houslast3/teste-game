const socket = io();

let currentRoom = null;
let isHost = false;
let userId = localStorage.getItem('userId') || Date.now().toString(36);
let currentQuizId = null;

localStorage.setItem('userId', userId);

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

function showPublicQuizzes() {
    showScreen('public-quizzes');
    loadPublicQuizzes();
}

function showCreateQuiz() {
    showScreen('create-quiz');
}

// Funções para questionários públicos
async function loadPublicQuizzes() {
    const searchTerm = document.getElementById('quiz-search')?.value || '';
    const response = await fetch(`/api/quizzes?search=${encodeURIComponent(searchTerm)}`);
    const quizzes = await response.json();
    
    const quizzesList = document.getElementById('quizzes-list');
    quizzesList.innerHTML = '';
    
    quizzes.forEach(quiz => {
        const card = document.createElement('div');
        card.className = `quiz-card ${quiz.userId === userId ? 'own-quiz' : ''}`;
        
        card.innerHTML = `
            <div class="title">${quiz.title}</div>
            ${quiz.userId === userId ? 
                `<button class="edit-btn" onclick="editQuiz('${quiz.id}')">Editar</button>` : 
                ''}
        `;
        
        if (quiz.userId !== userId) {
            card.onclick = () => usePublicQuiz(quiz);
        }
        
        quizzesList.appendChild(card);
    });
}

async function savePublicQuiz() {
    const title = document.getElementById('quiz-title').value.trim();
    const questions = document.getElementById('quiz-questions').value.trim();
    
    if (!title || !questions) {
        alert('Por favor, preencha todos os campos');
        return;
    }
    
    const response = await fetch('/api/quizzes', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            title,
            questions,
            userId
        })
    });
    
    if (response.ok) {
        showPublicQuizzes();
    }
}

async function editQuiz(quizId) {
    const response = await fetch(`/api/quizzes/${quizId}`);
    const quiz = await response.json();
    
    document.getElementById('edit-quiz-title').value = quiz.title;
    document.getElementById('edit-quiz-questions').value = quiz.questions;
    currentQuizId = quizId;
    
    showScreen('edit-quiz');
}

async function updatePublicQuiz() {
    const title = document.getElementById('edit-quiz-title').value.trim();
    const questions = document.getElementById('edit-quiz-questions').value.trim();
    
    if (!title || !questions) {
        alert('Por favor, preencha todos os campos');
        return;
    }
    
    const response = await fetch(`/api/quizzes/${currentQuizId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            title,
            questions,
            userId
        })
    });
    
    if (response.ok) {
        showPublicQuizzes();
    }
}

function usePublicQuiz(quiz) {
    document.getElementById('questions').value = quiz.questions;
    showCreateRoom();
}

// Funções de criação e entrada em sala
function createRoom() {
    const hostName = document.getElementById('host-name').value.trim();
    const questions = document.getElementById('questions').value.trim();
    const timePerQuestion = parseInt(document.getElementById('time-per-question').value) || 30;
    
    if (!hostName || !questions) {
        alert('Por favor, preencha todos os campos');
        return;
    }

    socket.emit('createRoom', { hostName, questions, timePerQuestion });
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

function leaveRoom() {
    if (currentRoom) {
        socket.emit('leaveRoom', currentRoom);
        showInitialScreen();
    }
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

// Funções auxiliares
function parseContent(content) {
    const imgMatch = content.match(/\[img:(.*?)\]/);
    if (imgMatch) {
        const imgUrl = imgMatch[1];
        const text = content.replace(/\[img:.*?\]/, '').trim();
        return {
            text,
            imgUrl
        };
    }
    return {
        text: content,
        imgUrl: null
    };
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

socket.on('newQuestion', ({ question, answers, timeLeft }) => {
    const parsedQuestion = parseContent(question);
    document.getElementById('question-display').innerHTML = `
        ${parsedQuestion.text}
        ${parsedQuestion.imgUrl ? `<br><img src="${parsedQuestion.imgUrl}" alt="Imagem da pergunta">` : ''}
    `;
    
    document.getElementById('timer-display').textContent = `${timeLeft} segundos`;
    document.getElementById('result-display').classList.add('hidden');
    document.getElementById('answers-grid').classList.remove('hidden');
    
    if (isHost) {
        document.getElementById('host-next').classList.add('hidden');
    }

    answers.forEach((answer, index) => {
        const parsedAnswer = parseContent(answer);
        const button = document.getElementById(`answer-${index}`);
        button.innerHTML = `
            ${parsedAnswer.imgUrl ? `<img src="${parsedAnswer.imgUrl}" alt="Imagem da resposta">` : ''}
            ${parsedAnswer.text}
        `;
        button.disabled = false;
        button.onclick = () => submitAnswer(index);
    });
});

socket.on('updateTimer', (timeLeft) => {
    document.getElementById('timer-display').textContent = `${timeLeft} segundos`;
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

// Inicializar evento de pesquisa
document.getElementById('quiz-search')?.addEventListener('input', (e) => {
    loadPublicQuizzes();
});