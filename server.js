const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static('public'));

const rooms = new Map();

function generateRoomCode() {
    return Math.floor(10000 + Math.random() * 90000).toString();
}

io.on('connection', (socket) => {
    console.log('User connected');

    socket.on('createRoom', ({ hostName, questions }) => {
        const roomCode = generateRoomCode();
        const room = {
            host: socket.id,
            hostName,
            players: [{id: socket.id, name: hostName, score: 0}],
            questions: questions.split(';').filter(q => q.trim()),
            currentQuestion: 0,
            answers: new Map(),
            inGame: false
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
                sendQuestion(roomCode);
            }, 4000);
        }
    });

    socket.on('submitAnswer', ({ roomCode, answerIndex }) => {
        const room = rooms.get(roomCode);
        if (room && room.inGame) {
            room.answers.set(socket.id, answerIndex);
            
            if (room.answers.size === room.players.length) {
                const currentQuestionData = room.questions[room.currentQuestion];
                const [question, ...answers] = currentQuestionData.split(',');
                const correctIndex = answers.findIndex(a => a.startsWith('$'));
                
                room.players.forEach(player => {
                    if (room.answers.get(player.id) === correctIndex) {
                        player.score += 100;
                    }
                });

                io.to(roomCode).emit('showResults', {
                    correctIndex,
                    players: room.players
                });

                room.answers.clear();
            }
        }
    });

    socket.on('nextQuestion', (roomCode) => {
        const room = rooms.get(roomCode);
        if (room && socket.id === room.host) {
            room.currentQuestion++;
            if (room.currentQuestion < room.questions.length) {
                sendQuestion(roomCode);
            } else {
                io.to(roomCode).emit('gameOver', { players: room.players });
                rooms.delete(roomCode);
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

function sendQuestion(roomCode) {
    const room = rooms.get(roomCode);
    if (room) {
        const questionData = room.questions[room.currentQuestion];
        const [question, ...answers] = questionData.split(',');
        const formattedAnswers = answers.map(a => a.replace('$', ''));
        io.to(roomCode).emit('newQuestion', {
            question,
            answers: formattedAnswers
        });
    }
}

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
