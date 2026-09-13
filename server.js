const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, './')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const rooms = {};

// Map user-typed topics to Open Trivia API Category IDs
const categoryMap = {
  math: 19,
  gaming: 15,
  games: 15,
  science: 17,
  history: 23,
  geography: 22,
  world: 22,
  aviation: 28,
  vehicles: 28,
  computers: 18,
  tech: 18,
  music: 12,
  movies: 11,
  sports: 21,
  anime: 31,
  general: 9
};

// Helper: Decode the Base64 text from the API
function decodeBase64(str) {
  return Buffer.from(str, 'base64').toString('utf8');
}

// Fetch questions live from the internet!
async function fetchQuestionsFromWeb(topicInput) {
  let categoryId = 9; // Default to General Knowledge
  
  // Find matching category ID based on what the host typed
  if (topicInput) {
    const searchTopic = topicInput.toLowerCase();
    const matchedKey = Object.keys(categoryMap).find(key => searchTopic.includes(key));
    if (matchedKey) {
      categoryId = categoryMap[matchedKey];
    }
  }

  try {
    // Fetch 10 multiple-choice questions in Base64 format to avoid weird text symbols
    const url = `https://opentdb.com/api.php?amount=10&category=${categoryId}&type=multiple&encode=base64`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.results && data.results.length > 0) {
      return data.results.map(q => {
        const questionText = decodeBase64(q.question);
        const correct = decodeBase64(q.correct_answer);
        const incorrects = q.incorrect_answers.map(decodeBase64);

        // Combine all answers and shuffle them randomly
        const allOptions = [...incorrects, correct].sort(() => Math.random() - 0.5);
        const correctIndex = allOptions.indexOf(correct);

        return {
          question: questionText,
          options: allOptions,
          answer: correctIndex
        };
      });
    }
  } catch (err) {
    console.error("API Error:", err);
  }

  // Backup question if the internet fails
  return [{ question: "Network error! What is 2 + 2?", options: ["3", "4", "5", "6"], answer: 1 }];
}

function generateRoomCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

function startTimer(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;

  room.timeLeft = 15;
  clearInterval(room.timerInterval);
  io.to(roomCode).emit('timerUpdate', room.timeLeft);

  room.timerInterval = setInterval(() => {
    room.timeLeft -= 1;
    io.to(roomCode).emit('timerUpdate', room.timeLeft);

    if (room.timeLeft <= 0) {
      endQuestionRound(roomCode);
    }
  }, 1000);
}

function endQuestionRound(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;

  clearInterval(room.timerInterval);
  const currentQ = room.questions[room.currentQuestion];

  io.to(roomCode).emit('roundEnded', {
    correctAnswerText: currentQ.options[currentQ.answer],
    players: room.players.sort((a, b) => b.score - a.score)
  });
}

io.on('connection', (socket) => {
  socket.on('createRoom', ({ hostName }) => {
    const roomCode = generateRoomCode();
    rooms[roomCode] = {
      hostId: socket.id,
      players: [{ id: socket.id, name: hostName, score: 0, streak: 0, answered: false }],
      questions: [],
      currentQuestion: 0,
      state: 'LOBBY',
      timerInterval: null,
      timeLeft: 15
    };
    socket.join(roomCode);
    socket.emit('roomCreated', { roomCode, players: rooms[roomCode].players });
  });

  socket.on('joinRoom', ({ roomCode, playerName }) => {
    const room = rooms[roomCode];
    if (!room) return socket.emit('errorMsg', 'Room not found!');
    if (room.state !== 'LOBBY') return socket.emit('errorMsg', 'Game already started!');

    room.players.push({ id: socket.id, name: playerName, score: 0, streak: 0, answered: false });
    socket.join(roomCode);

    io.to(roomCode).emit('playerJoined', { players: room.players });
    socket.emit('joinedSuccess', { roomCode });
  });

  // Async function because fetching from the web takes a second
  socket.on('startGame', async ({ roomCode, mainTopic }) => {
    const room = rooms[roomCode];
    if (room && room.hostId === socket.id) {
      
      // Let players know we are generating questions
      io.to(roomCode).emit('gameLoading'); 

      room.questions = await fetchQuestionsFromWeb(mainTopic);
      room.state = 'PLAYING';
      room.currentQuestion = 0;

      sendCurrentQuestion(roomCode);
    }
  });

  socket.on('submitAnswer', ({ roomCode, answerIndex }) => {
    const room = rooms[roomCode];
    if (!room || room.state !== 'PLAYING') return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.answered) return;

    player.answered = true;
    const currentQ = room.questions[room.currentQuestion];

    if (answerIndex === currentQ.answer) {
      player.streak += 1;
      const speedBonus = room.timeLeft * 10;
      const streakMultiplier = player.streak >= 3 ? 1.5 : 1.0;
      player.score += Math.round((100 + speedBonus) * streakMultiplier);
    } else {
      player.streak = 0;
    }

    if (room.players.every(p => p.answered)) {
      endQuestionRound(roomCode);
    }
  });

  socket.on('nextQuestion', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (!room || room.hostId !== socket.id) return;

    room.currentQuestion += 1;
    if (room.currentQuestion < room.questions.length) {
      sendCurrentQuestion(roomCode);
    } else {
      io.to(roomCode).emit('gameOver', { players: room.players.sort((a,b) => b.score - a.score) });
    }
  });
});

function sendCurrentQuestion(roomCode) {
  const room = rooms[roomCode];
  room.players.forEach(p => p.answered = false);

  io.to(roomCode).emit('newQuestion', {
    question: room.questions[room.currentQuestion],
    questionIndex: room.currentQuestion + 1,
    totalQuestions: room.questions.length
  });

  startTimer(roomCode);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server live on port ${PORT}`);
});
