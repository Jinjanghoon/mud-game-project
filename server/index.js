const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { Pool } = require('pg');
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

// ✅ DB 연결 설정 (Railway 환경변수 사용)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ✅ 서버 시작 시 테이블 확인 (비밀번호 컬럼 포함)
pool.query(`
  CREATE TABLE IF NOT EXISTS players (
    name VARCHAR(50) PRIMARY KEY,
    password VARCHAR(255),
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

  // 1. 회원가입 요청
  socket.on('req_register', async ({ id, pw }) => {
    try {
      // 닉네임 중복 체크
      const check = await pool.query('SELECT * FROM players WHERE name = $1', [id]);
      if (check.rows.length > 0) {
        socket.emit('login_fail', '이미 존재하는 닉네임입니다.');
        return;
      }
      // 신규 유저 생성 (비밀번호 포함)
      await pool.query('INSERT INTO players (name, password) VALUES ($1, $2)', [id, pw]);
      socket.emit('register_success', `가입 완료! 로그인해주세요.`);
    } catch (err) {
      console.error(err);
      socket.emit('login_fail', '회원가입 중 오류 발생');
    }
  });

  // 2. 로그인 요청
  socket.on('req_login', async ({ id, pw }) => {
    try {
      // 아이디와 비밀번호 확인
      const res = await pool.query('SELECT * FROM players WHERE name = $1 AND password = $2', [id, pw]);
      
      if (res.rows.length > 0) {
        // 로그인 성공
        const playerData = res.rows[0];
        connectedPlayers[socket.id] = playerData;
        
        socket.emit('login_success', playerData);
        socket.emit('log_message', `[시스템] 환영합니다, ${playerData.name}님! (LV.${playerData.level})`);
      } else {
        // 로그인 실패
        socket.emit('login_fail', '아이디 또는 비밀번호가 틀렸습니다.');
      }
    } catch (err) {
      console.error(err);
      socket.emit('login_fail', '로그인 처리 중 오류 발생');
    }
  });

  // 3. 연결 종료 (자동 저장)
  socket.on('disconnect', async () => {
    const player = connectedPlayers[socket.id];
    if (player) {
      try {
        await pool.query(
          'UPDATE players SET level=$1, hp=$2, exp=$3 WHERE name=$4',
          [player.level, player.hp, player.exp, player.name]
        );
        console.log(`${player.name} 저장 완료 및 퇴장`);
      } catch (err) {
        console.error('저장 실패:', err);
      }
      delete connectedPlayers[socket.id];
    }
  });
});

server.listen(process.env.PORT || 3001, () => {
  console.log('SERVER RUNNING');
});