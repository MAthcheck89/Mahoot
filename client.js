const socket = io();
let currentRoomCode = null;
let isHost = false;

function createLobby() {
  const hostName = document.getElementById('username').value || 'Host';
  isHost = true;
  socket.emit('createRoom', { hostName });
}

function joinLobby() {
  const playerName = document.getElementById('username').value || 'Player';
  const roomCode = document.getElementById('room-code-input').value;
  socket.emit('joinRoom', { roomCode, playerName });
}

function startGame() {
  const mainTopic = document.getElementById('mainTopic').value;
  socket.emit('startGame', { roomCode: currentRoomCode, mainTopic });
}

// Add this anywhere in client.js with your other socket.on events
socket.on('gameLoading', () => {
  document.getElementById('lobby-screen').classList.add('hidden');
  document.getElementById('game-screen').classList.remove('hidden');
  document.getElementById('question-text').innerText = "🤖 AI is generating questions from the web... Get ready!";
  document.getElementById('options-grid').innerHTML = '';
});

  socket.emit('startGame', { roomCode: currentRoomCode, topics });
}

function sendAnswer(index) {
  socket.emit('submitAnswer', { roomCode: currentRoomCode, answerIndex: index });
}

function nextQuestion() {
  socket.emit('nextQuestion', { roomCode: currentRoomCode });
}

// Socket Events
socket.on('roomCreated', ({ roomCode, players }) => {
  currentRoomCode = roomCode;
  document.getElementById('menu-screen').classList.add('hidden');
  document.getElementById('lobby-screen').classList.remove('hidden');
  document.getElementById('host-controls').classList.remove('hidden');
  document.getElementById('lobby-code-display').innerText = roomCode;
  updatePlayerList(players);
});

socket.on('joinedSuccess', ({ roomCode }) => {
  currentRoomCode = roomCode;
  document.getElementById('menu-screen').classList.add('hidden');
  document.getElementById('lobby-screen').classList.remove('hidden');
  document.getElementById('lobby-code-display').innerText = roomCode;
});

socket.on('playerJoined', ({ players }) => {
  updatePlayerList(players);
});

socket.on('gameStarted', ({ question }) => {
  document.getElementById('lobby-screen').classList.add('hidden');
  document.getElementById('game-screen').classList.remove('hidden');
  if (isHost) document.getElementById('host-next-btn').classList.remove('hidden');
  displayQuestion(question);
});

socket.on('newQuestion', ({ question }) => {
  displayQuestion(question);
});

socket.on('updateScores', ({ players }) => {
  const lb = document.getElementById('leaderboard');
  lb.innerHTML = players
    .sort((a,b) => b.score - a.score)
    .map(p => `<li>${p.name}: ${p.score} pts 🔥x${p.streak}</li>`).join('');
});

socket.on('gameOver', ({ players }) => {
  document.getElementById('question-text').innerText = '🎉 Game Over!';
  document.getElementById('options-grid').innerHTML = '';
});

socket.on('errorMsg', (msg) => alert(msg));

function updatePlayerList(players) {
  document.getElementById('player-list').innerHTML = players.map(p => `<li>${p.name}</li>`).join('');
}

function displayQuestion(q) {
  document.getElementById('question-text').innerText = q.question;
  const grid = document.getElementById('options-grid');
  grid.innerHTML = '';
  q.options.forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.innerText = opt;
    btn.onclick = () => sendAnswer(idx);
    grid.appendChild(btn);
  });
}
