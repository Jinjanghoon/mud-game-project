const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { Pool } = require('pg'); // DB 연동 도구
require('dotenv').config();

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// ✅ DB 연결 설정 (Railway가 주는 주소를 자동으로 가져옴)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // 클라우드 DB 접속시 필수 옵션
});

// ✅ 서버 켜질 때 '유저 테이블'이 없으면 만들기
pool.query(`
  CREATE TABLE IF NOT EXISTS players (
    name VARCHAR(50) PRIMARY KEY,
    level INT DEFAULT 1,
    hp INT DEFAULT 100,
    max_hp INT DEFAULT 100,
    exp INT DEFAULT 0
  )
`).then(() => console.log("DB 테이블 체크 완료"))
  .catch(err => console.error("DB 테이블 에러:", err));

// 접속한 유저 관리 (메모리)
let connectedPlayers = {};

io.on('connection', (socket) => {
  console.log(`접속: ${socket.id}`);

  // 1. 게임 입장 (DB에서 불러오기)
  socket.on('join_game', async (nickname) => {
    try {
      // DB에 있나 확인
      const res = await pool.query('SELECT * FROM players WHERE name = $1', [nickname]);
      
      let playerData;
      if (res.rows.length > 0) {
        // 있으면 불러오기
        playerData = res.rows[0];
        socket.emit('log_message', `[시스템] 돌아오셨군요, ${nickname}님! (LV.${playerData.level})`);
      } else {
        // 없으면 새로 만들기
        await pool.query('INSERT INTO players (name) VALUES ($1)', [nickname]);
        playerData = { name: nickname, level: 1, hp: 100, max_hp: 100, exp: 0 };
        socket.emit('log_message', `[시스템] ${nickname}님, 텍스트의 숲에 오신 것을 환영합니다.`);
      }

      // 메모리에 등록 및 상태 전송
      connectedPlayers[socket.id] = playerData;
      socket.emit('update_status', playerData);

    } catch (err) {
      console.error(err);
      socket.emit('log_message', `[시스템] 데이터 로딩 실패!`);
    }
  });

  // 2. 연결 끊기 (자동 저장)
  socket.on('disconnect', async () => {
    const player = connectedPlayers[socket.id];
    if (player) {
      // 나갈 때 DB에 최신 정보 저장
      await pool.query(
        'UPDATE players SET level=$1, hp=$2, exp=$3 WHERE name=$4',
        [player.level, player.hp, player.exp, player.name]
      );
      console.log(`${player.name} 저장 완료 및 퇴장`);
      delete connectedPlayers[socket.id];
    }
  });
});

server.listen(process.env.PORT || 3001, () => {
  console.log('SERVER RUNNING');
});