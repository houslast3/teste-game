let socket = io();
let currentScreen = 'initial-screen';
let isHost = false;
let selectedAnswer = null;
let currentQuestion = null;
let timePerQuestion = 30;
let countdown;

function showScreen(screenId) {
    document.getElementById(currentScreen).classList.add('hidden');
    document.getElementById(screenId).classList.remove('hidden');
    currentScreen = screenId;
}

function showInitialScreen() {
    showScreen('initial-screen');
    resetGame();
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

function resetGame() {
    isHost = false;
    selectedAnswer = null;
    currentQuestion = null;
    if (countdown) {
        clearInterval(countdown);
    }
}

function createRoom() {
    const questions = document.getElementById('create-questions').value;
    const timePerQ = document.getElementById('time-per-question').value;
    const hostName = document.getElementById('host-name').value;
    
    if (!questions) {
        alert('Por favor, adicione algumas perguntas');
        return;
    }

    if (timePerQ < 10 || timePerQ > 120) {
        alert('O tempo por pergunta deve estar entre 10 e 120 segundos');
        return;
    }

    if (!hostName) {
        alert('Por favor, digite seu nome');
        return;
    }

    isHost = true;
    timePerQuestion = parseInt(timePerQ);
    socket.emit('createRoom', { playerName: hostName, questions, timePerQuestion });
}

function joinRoom() {
    const roomCode = document.getElementById('room-code').value;
    const playerName = document.getElementById('player-name').value;

    if (!roomCode || !playerName) {
        alert('Por favor, preencha todos os campos');
        return;
    }

    socket.emit('joinRoom', { roomCode, playerName });
}

function leaveRoom() {
    socket.emit('leaveRoom');
    showInitialScreen();
}

function startGame() {
    socket.emit('startGame');
}

function selectAnswer(index) {
    if (selectedAnswer !== null) return;
    selectedAnswer = index;
    document.querySelectorAll('.answer-btn').forEach(btn => {
        btn.classList.remove('selected');
        if (parseInt(btn.dataset.index) === index) {
            btn.classList.add('selected');
        }
    });
    socket.emit('submitAnswer', index);
}

function nextQuestion() {
    socket.emit('nextQuestion');
}

function showQuestion(question) {
    currentQuestion = question;
    selectedAnswer = null;
    document.getElementById('countdown').classList.add('hidden');
    
    const questionDisplay = document.getElementById('question-display');
    const answersGrid = document.getElementById('answers-grid');
    const resultDisplay = document.getElementById('result-display');
    
    questionDisplay.innerHTML = formatContent(question.question);
    
    for (let i = 0; i < 4; i++) {
        const button = document.getElementById(`answer-${i}`);
        button.innerHTML = formatContent(question.answers[i]);
        button.classList.remove('selected', 'correct', 'incorrect');
        button.disabled = false;
    }
    
    answersGrid.classList.remove('hidden');
    resultDisplay.classList.add('hidden');
    
    if (isHost) {
        document.getElementById('host-next').classList.add('hidden');
    }
}

function formatContent(content) {
    if (!content) return '';
    const imgMatch = content.match(/\[img:(.*?)\]/);
    if (imgMatch) {
        const text = content.replace(/\[img:.*?\]/, '').trim();
        const imgUrl = imgMatch[1];
        return `${text}<br><img src="${imgUrl}" alt="Question Image">`;
    }
    return content;
}

function showResult(result) {
    const answersGrid = document.getElementById('answers-grid');
    const resultDisplay = document.getElementById('result-display');
    
    document.querySelectorAll('.answer-btn').forEach(btn => {
        btn.disabled = true;
        const index = parseInt(btn.dataset.index);
        if (index === result.correctAnswer) {
            btn.classList.add('correct');
        } else if (index === selectedAnswer && selectedAnswer !== result.correctAnswer) {
            btn.classList.add('incorrect');
        }
    });

    document.getElementById('correct-answer').innerHTML = `Resposta correta: ${currentQuestion.answers[result.correctAnswer]}`;
    document.getElementById('scores').innerHTML = Object.entries(result.scores)
        .map(([player, score]) => `${player}: ${score}`)
        .join('<br>');

    resultDisplay.classList.remove('hidden');
    
    if (isHost) {
        document.getElementById('host-next').classList.remove('hidden');
    }
}

function showFinalScores(scores) {
    showScreen('final-screen');
    const sortedScores = Object.entries(scores)
        .sort(([,a], [,b]) => b - a);
    
    document.getElementById('final-scores').innerHTML = 
        `<h3>Ranking Final</h3>` +
        sortedScores.map(([player, score], index) => 
            `${index + 1}. ${player}: ${score}`
        ).join('<br>');
}

async function generateQuiz() {
    const topic = document.getElementById('quiz-topic').value.trim();
    if (!topic) {
        alert('Por favor, digite um assunto para gerar o questionário');
        return;
    }

    try {
        const encodedTopic = encodeURIComponent(`Gere 5 perguntas de múltipla escolha sobre ${topic}. Use o formato: pergunta,resposta1,resposta2,$respostacorreta,resposta4;`);
        const response = await fetch(`https://api.wit.ai/message?v=20241124&q=${encodedTopic}`, {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer 2FNM6QK5EPVUU65CZYV7GKXSJYHVJSZA'
            }
        });

        if (!response.ok) {
            throw new Error('Erro ao comunicar com a API do Wit.ai');
        }

        const data = await response.json();
        console.log('Wit.ai response:', data);

        // Get the generated text from the response
        const generatedText = data.text || '';
        
        // Process the response into quiz format
        const questions = processWitResponse(generatedText, topic);
        document.getElementById('quiz-questions').value = questions;
    } catch (error) {
        console.error('Error:', error);
        alert('Erro ao gerar o questionário. Por favor, tente novamente.');
    }
}

function processWitResponse(text, topic) {
    // If we got a proper response from Wit.ai, use it
    if (text && text.includes('?')) {
        return text;
    }

    // Fallback questions if the API response isn't in the expected format
    const questions = [
        `Qual é o principal conceito de ${topic}?,Conceito básico,Conceito intermediário,$Conceito avançado,Nenhum dos anteriores;`,
        `Qual é a aplicação mais comum de ${topic}?,Uso pessoal,Uso comercial,$Uso profissional,Uso educacional;`,
        `Como ${topic} impacta a sociedade moderna?,Baixo impacto,Médio impacto,$Alto impacto,Nenhum impacto;`,
        `Qual é a tendência futura para ${topic}?,Diminuição,Estagnação,$Crescimento,Obsolescência;`,
        `Quem são os principais beneficiados por ${topic}?,Empresas,Governos,$Sociedade em geral,Indivíduos específicos;`
    ];
    
    return questions.join('\n');
}

function savePublicQuiz() {
    const title = document.getElementById('quiz-title').value;
    const questions = document.getElementById('quiz-questions').value;
    const creatorName = document.getElementById('quiz-creator-name').value;

    if (!title || !questions || !creatorName) {
        alert('Por favor, preencha todos os campos (nome, título e perguntas)');
        return;
    }

    const quizzes = getPublicQuizzes();
    const newQuiz = {
        id: Date.now().toString(),
        title,
        questions,
        creator: creatorName,
        userId: getUserId(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    quizzes.push(newQuiz);
    localStorage.setItem('publicQuizzes', JSON.stringify(quizzes));
    showPublicQuizzes();
    alert('Questionário salvo com sucesso!');
}

function loadPublicQuizzes() {
    const quizzes = getPublicQuizzes();
    const quizzesList = document.getElementById('quizzes-list');
    quizzesList.innerHTML = '';

    quizzes.forEach(quiz => {
        const card = document.createElement('div');
        card.className = 'quiz-card';
        card.innerHTML = `
            <h3>${quiz.title}</h3>
            <p>Criado por: ${quiz.creator || 'Anônimo'}</p>
            <p>Atualizado em: ${new Date(quiz.updatedAt).toLocaleDateString()}</p>
            <div class="quiz-actions">
                <button class="use-btn" onclick="useQuiz('${quiz.id}')">Usar</button>
                <button class="edit-btn" onclick="editQuiz('${quiz.id}')">Editar</button>
                <button class="delete-btn" onclick="deleteQuiz('${quiz.id}')">Excluir</button>
            </div>
        `;
        quizzesList.appendChild(card);
    });
}

function deleteQuiz(quizId) {
    if (confirm('Tem certeza que deseja excluir este questionário?')) {
        const quizzes = getPublicQuizzes();
        const updatedQuizzes = quizzes.filter(quiz => quiz.id !== quizId);
        localStorage.setItem('publicQuizzes', JSON.stringify(updatedQuizzes));
        loadPublicQuizzes();
    }
}

function editQuiz(quizId) {
    const quizzes = getPublicQuizzes();
    const quiz = quizzes.find(q => q.id === quizId);
    if (quiz) {
        document.getElementById('edit-quiz-title').value = quiz.title;
        document.getElementById('edit-quiz-questions').value = quiz.questions;
        document.getElementById('edit-quiz').dataset.quizId = quizId;
        showScreen('edit-quiz');
    }
}

function updateQuiz() {
    const quizId = document.getElementById('edit-quiz').dataset.quizId;
    const title = document.getElementById('edit-quiz-title').value;
    const questions = document.getElementById('edit-quiz-questions').value;

    if (!title || !questions) {
        alert('Por favor, preencha todos os campos');
        return;
    }

    const quizzes = getPublicQuizzes();
    const quizIndex = quizzes.findIndex(q => q.id === quizId);
    
    if (quizIndex !== -1) {
        quizzes[quizIndex] = {
            ...quizzes[quizIndex],
            title,
            questions,
            updatedAt: new Date().toISOString()
        };
        
        localStorage.setItem('publicQuizzes', JSON.stringify(quizzes));
        showPublicQuizzes();
        alert('Questionário atualizado com sucesso!');
    }
}

function useQuiz(quizId) {
    const quiz = getPublicQuizzes().find(q => q.id === quizId);
    if (!quiz) return;

    document.getElementById('create-questions').value = quiz.questions;
    showCreateRoom();
}

function getUserId() {
    let userId = localStorage.getItem('userId');
    if (!userId) {
        userId = 'user_' + Date.now();
        localStorage.setItem('userId', userId);
    }
    return userId;
}

function getPublicQuizzes() {
    return JSON.parse(localStorage.getItem('publicQuizzes') || '[]');
}

function toggleExamples() {
    const panel = document.getElementById('examples-panel');
    panel.classList.toggle('hidden');
}

// Socket event handlers
socket.on('roomCreated', (roomCode) => {
    document.getElementById('room-info').textContent = `Código da sala: ${roomCode}`;
    showScreen('waiting-room');
    document.getElementById('host-controls').classList.remove('hidden');
});

socket.on('roomJoined', () => {
    showScreen('waiting-room');
    document.getElementById('host-controls').classList.add('hidden');
});

socket.on('updatePlayers', (players) => {
    const playersList = document.getElementById('players-list');
    playersList.innerHTML = players
        .map(player => `<div class="player-item">${player}</div>`)
        .join('');
});

socket.on('gameStarting', () => {
    showScreen('game-screen');
    const countdownDisplay = document.getElementById('countdown');
    let count = 3;
    
    countdownDisplay.textContent = count;
    countdownDisplay.classList.remove('hidden');
    
    const interval = setInterval(() => {
        count--;
        if (count > 0) {
            countdownDisplay.textContent = count;
        } else {
            clearInterval(interval);
            countdownDisplay.classList.add('hidden');
            socket.emit('readyForQuestion');
        }
    }, 1000);
});

socket.on('showQuestion', (question) => {
    showQuestion(question);
    
    const timerDisplay = document.getElementById('timer-display');
    let timeLeft = timePerQuestion;
    
    timerDisplay.textContent = `Tempo: ${timeLeft}s`;
    
    if (countdown) {
        clearInterval(countdown);
    }
    
    countdown = setInterval(() => {
        timeLeft--;
        timerDisplay.textContent = `Tempo: ${timeLeft}s`;
        
        if (timeLeft <= 0) {
            clearInterval(countdown);
            if (selectedAnswer === null) {
                socket.emit('submitAnswer', null);
            }
        }
    }, 1000);
});

socket.on('showResult', (result) => {
    if (countdown) {
        clearInterval(countdown);
    }
    showResult(result);
});

socket.on('gameOver', (finalScores) => {
    showFinalScores(finalScores);
});

socket.on('error', (message) => {
    alert(message);
    showInitialScreen();
});
