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

function sendAnswer(index) {
  const btns = document.querySelectorAll('#options-grid button');
  btns.forEach(btn => btn.disabled = true);
  socket.emit('submitAnswer', { roomCode: currentRoomCode, answerIndex: index });
}

function nextQuestion() {
  socket.emit('nextQuestion', { roomCode: currentRoomCode });
}

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

socket.on('playerJoined', ({ players }) => updatePlayerList(players));

socket.on('gameLoading', () => {
  document.getElementById('lobby-screen').classList.add('hidden');
  document.getElementById('game-screen').classList.remove('hidden');
  document.getElementById('question-text').innerText = "🤖 Fetching questions from the web...";
  document.getElementById('options-grid').innerHTML = '';
});

socket.on('newQuestion', ({ question, questionIndex, totalQuestions }) => {
  document.getElementById('results-screen').classList.add('hidden');
  document.getElementById('game-screen').classList.remove('hidden');
  document.getElementById('question-tracker').innerText = `Question ${questionIndex}/${totalQuestions}`;
  document.getElementById('question-text').innerText = question.question;

  const grid = document.getElementById('options-grid');
  grid.innerHTML = '';
  question.options.forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.innerText = opt;
    btn.onclick = () => sendAnswer(idx);
    grid.appendChild(btn);
  });
});

socket.on('timerUpdate', (seconds) => {
  document.getElementById('timer-display').innerText = seconds;
});

socket.on('roundEnded', ({ correctAnswerText, players }) => {
  document.getElementById('game-screen').classList.add('hidden');
  document.getElementById('results-screen').classList.remove('hidden');
  document.getElementById('correct-answer-reveal').innerHTML = `Correct Answer: <strong>${correctAnswerText}</strong>`;
  
  const lb = document.getElementById('leaderboard');
  lb.innerHTML = players.map((p, i) => 
    `<li><span>#${i + 1} ${p.name} ${p.streak >= 3 ? '🔥x' + p.streak : ''}</span> <strong>${p.score} pts</strong></li>`
  ).join('');

  if (isHost) document.getElementById('host-next-btn').classList.remove('hidden');
});

socket.on('gameOver', ({ players }) => {
  document.getElementById('game-screen').classList.add('hidden');
  document.getElementById('results-screen').classList.remove('hidden');
  document.getElementById('correct-answer-reveal').innerText = "🎉 Game Finished! Final Rankings:";
  document.getElementById('host-next-btn').classList.add('hidden');
});

socket.on('errorMsg', (msg) => alert(msg));

function updatePlayerList(players) {
  document.getElementById('player-list').innerHTML = players.map(p => `<li>${p.name}</li>`).join('');
}
