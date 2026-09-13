const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, './')));

const rooms = {};

// Helper: Generate a 4-digit room code
function generateRoomCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Fallback AI Question Generator (Mocking AI generation for rapid gameplay)
function generateQuestions(topics, count = 5) {
  const sampleDatabase = [
    { question: `What is the capital of France? (${topics[0] || 'General'})`, options: ['Paris', 'London', 'Berlin', 'Madrid'], answer: 0 },
    { question: `Which planet is known as the Red Planet? (${topics[1] || 'Science'})`, options: ['Earth', 'Mars', 'Jupiter', 'Saturn'], answer: 1 },
    { question: `How many wings does a Boeing 777 have? (${topics[2] || 'Aviation'})`, options: ['1 pair', '2 pairs', '3 pairs', 'None'], answer: 0 },
    { question: `What is the largest ocean on Earth? (${topics[3] || 'World'})`, options: ['Atlantic', 'Indian', 'Pacific', 'Arctic'], answer: 2 }
  ];
  return sampleDatabase.slice(0, count);
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Host Creates Lobby
  socket.on('createRoom', ({ hostName }) => {
    const roomCode = generateRoomCode();
    rooms[roomCode] = {
      hostId: socket.id,
      players: [{ id: socket.id, name: hostName, score: 0, streak: 0 }],
      topics: [],
      questions: [],
      currentQuestion: 0,
      state: 'LOBBY'
    };
    socket.join(roomCode);
    socket.emit('roomCreated', { roomCode, players: rooms[roomCode].players });
  });

  // Player Joins Lobby
  socket.on('joinRoom', ({ roomCode, playerName }) => {
    const room = rooms[roomCode];
    if (!room) {
      socket.emit('errorMsg', 'Room not found!');
      return;
    }
    if (room.state !== 'LOBBY') {
      socket.emit('errorMsg', 'Game already in progress!');
      return;
    }

    const player = { id: socket.id, name: playerName, score: 0, streak: 0 };
    room.players.push(player);
    socket.join(roomCode);

    io.to(roomCode).emit('playerJoined', { players: room.players });
    socket.emit('joinedSuccess', { roomCode });
  });

  // Host Starts Game with Selected Topics (Max 4)
  socket.on('startGame', ({ roomCode, topics }) => {
    const room = rooms[roomCode];
    if (room && room.hostId === socket.id) {
      room.topics = topics.slice(0, 4);
      room.questions = generateQuestions(room.topics);
      room.state = 'PLAYING';
      room.currentQuestion = 0;

      io.to(roomCode).emit('gameStarted', {
        question: room.questions[0],
        questionIndex: 0,
        totalQuestions: room.questions.length
      });
    }
  });

  // Submit Answer
  socket.on('submitAnswer', ({ roomCode, answerIndex }) => {
    const room = rooms[roomCode];
    if (!room) return;

    const currentQ = room.questions[room.currentQuestion];
    const player = room.players.find(p => p.id === socket.id);

    if (player && currentQ) {
      if (answerIndex === currentQ.answer) {
        player.streak += 1;
        const multiplier = player.streak >= 3 ? 1.5 : 1;
        player.score += Math.round(100 * multiplier);
      } else {
        player.streak = 0;
      }
    }

    // Broadcast Leaderboard
    io.to(roomCode).emit('updateScores', { players: room.players });
  });

  // Next Question / End Game
  socket.on('nextQuestion', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (!room || room.hostId !== socket.id) return;

    room.currentQuestion += 1;
    if (room.currentQuestion < room.questions.length) {
      io.to(roomCode).emit('newQuestion', {
        question: room.questions[room.currentQuestion],
        questionIndex: room.currentQuestion
      });
    } else {
      io.to(roomCode).emit('gameOver', { players: room.players });
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
