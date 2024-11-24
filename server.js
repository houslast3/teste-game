const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static('public'));
app.use(express.json());

const rooms = new Map();
const publicQuizzes = new Map();

function generateRoomCode() {
    return Math.floor(10000 + Math.random() * 90000).toString();
}

function generateQuizId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// API endpoints para questionários públicos
app.post('/api/quizzes', (req, res) => {
    const { title, questions, userId } = req.body;
    const quizId = generateQuizId();
    publicQuizzes.set(quizId, { id: quizId, title, questions, userId, createdAt: Date.now() });
    res.json({ id: quizId });
});

app.get('/api/quizzes', (req, res) => {
    const { search } = req.query;
    let quizzes = Array.from(publicQuizzes.values());
    if (search) {
        quizzes = quizzes.filter(quiz => 
            quiz.title.toLowerCase().includes(search.toLowerCase())
        );
    }
    res.json(quizzes);
});

app.put('/api/quizzes/:id', (req, res) => {
    const { id } = req.params;
    const { title, questions, userId } = req.body;
    if (publicQuizzes.has(id)) {
        const quiz = publicQuizzes.get(id);
        if (quiz.userId === userId) {
            publicQuizzes.set(id, { ...quiz, title, questions });
            res.json({ success: true });
        } else {
            res.status(403).json({ error: 'Não autorizado' });
        }
    } else {
        res.status(404).json({ error: 'Questionário não encontrado' });
    }
});

io.on('connection', (socket) => {
    console.log('User connected');

    socket.on('createRoom', ({ hostName, questions, timePerQuestion }) => {
        const roomCode = generateRoomCode();
        const room = {
            host: socket.id,
            hostName,
            players: [{id: socket.id, name: hostName, score: 0}],
            questions: questions.split(';').filter(q => q.trim()),
            currentQuestion: 0,
            answers: new Map(),
            inGame: false,
            timePerQuestion,
            timer: null
        };
        rooms.set(roomCode, room);
        socket.join(roomCode);
        socket.emit('roomCreated', { roomCode, isHost: true });
        io.to(roomCode).emit('updatePlayers', room.players);
    });

    socket.on('joinRoom', ({ roomCode, playerName }) => {
        const room = rooms.get(roomCode);
        if (room && !room.inGame) {
            socket.join(roomCode);
            room.players.push({id: socket.id, name: playerName, score: 0});
            socket.emit('roomJoined', { roomCode, isHost: false });
            io.to(roomCode).emit('updatePlayers', room.players);
        } else {
            socket.emit('error', { message: 'Sala não encontrada ou jogo em andamento' });
        }
    });

    socket.on('startGame', (roomCode) => {
        const room = rooms.get(roomCode);
        if (room && socket.id === room.host) {
            room.inGame = true;
            room.currentQuestion = 0;
            io.to(roomCode).emit('gameStarting');
            setTimeout(() => {
                startQuestion(roomCode);
            }, 4000);
        }
    });

    socket.on('submitAnswer', ({ roomCode, answerIndex }) => {
        const room = rooms.get(roomCode);
        if (room && room.inGame) {
            room.answers.set(socket.id, answerIndex);
            
            if (room.answers.size === room.players.length) {
                clearTimeout(room.timer);
                showResults(roomCode);
            }
        }
    });

    socket.on('nextQuestion', (roomCode) => {
        const room = rooms.get(roomCode);
        if (room && socket.id === room.host) {
            room.currentQuestion++;
            if (room.currentQuestion < room.questions.length) {
                startQuestion(roomCode);
            } else {
                endGame(roomCode);
            }
        }
    });

    socket.on('disconnect', () => {
        rooms.forEach((room, roomCode) => {
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                room.players.splice(playerIndex, 1);
                if (socket.id === room.host) {
                    io.to(roomCode).emit('hostLeft');
                    rooms.delete(roomCode);
                } else {
                    io.to(roomCode).emit('updatePlayers', room.players);
                }
            }
        });
    });
});

function startQuestion(roomCode) {
    const room = rooms.get(roomCode);
    if (room) {
        room.answers.clear();
        const questionData = room.questions[room.currentQuestion];
        const [question, ...answers] = questionData.split(',');
        const formattedAnswers = answers.map(a => a.replace('$', ''));
        io.to(roomCode).emit('newQuestion', {
            question,
            answers: formattedAnswers,
            timeLeft: room.timePerQuestion
        });

        let timeLeft = room.timePerQuestion;
        const timerInterval = setInterval(() => {
            timeLeft--;
            io.to(roomCode).emit('updateTimer', timeLeft);
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                showResults(roomCode);
            }
        }, 1000);

        room.timer = setTimeout(() => {
            clearInterval(timerInterval);
            if (room.answers.size < room.players.length) {
                showResults(roomCode);
            }
        }, room.timePerQuestion * 1000);
    }
}

function showResults(roomCode) {
    const room = rooms.get(roomCode);
    if (room) {
        const currentQuestionData = room.questions[room.currentQuestion];
        const [question, ...answers] = currentQuestionData.split(',');
        const correctIndex = answers.findIndex(a => a.startsWith('$'));
        
        room.players.forEach(player => {
            const playerAnswer = room.answers.get(player.id);
            if (playerAnswer === correctIndex) {
                player.score += 100;
            }
        });

        io.to(roomCode).emit('showResults', {
            correctIndex,
            players: room.players
        });
    }
}

function endGame(roomCode) {
    const room = rooms.get(roomCode);
    if (room) {
        io.to(roomCode).emit('gameOver', { players: room.players });
        rooms.delete(roomCode);
    }
}

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
