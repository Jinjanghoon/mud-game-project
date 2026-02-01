// server/index.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // 실제 배포때는 프론트엔드 주소로 변경 필요
    methods: ["GET", "POST"]
  }
});

// 간단한 인메모리 DB (나중에 실제 DB 연결)
let players = {};

io.on('connection', (socket) => {
  console.log(`유저 접속함: ${socket.id}`);

  // 유저가 입장했을 때
  socket.on('join_game', (nickname) => {
    players[socket.id] = { name: nickname, level: 1, hp: 100 };
    
    // 나에게 환영 메시지 전송
    socket.emit('log_message', `[시스템] ${nickname}님, 텍스트의 숲에 오신 것을 환영합니다.`);
    
    // 내 캐릭터 정보 전송
    socket.emit('update_status', players[socket.id]);
  });

  socket.on('disconnect', () => {
    console.log(`유저 나감: ${socket.id}`);
    delete players[socket.id];
  });
});

// process.env.PORT는 서버가 주는 포트를 쓴다는 뜻입니다.
server.listen(process.env.PORT || 3001, () => {
  console.log('SERVER RUNNING ON PORT 3001');
});