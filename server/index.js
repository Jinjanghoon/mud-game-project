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

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ✅ DB 테이블 (없으면 생성)
pool.query(`
  CREATE TABLE IF NOT EXISTS players (
    name VARCHAR(50) PRIMARY KEY,
    password VARCHAR(255),
    level INT DEFAULT 1,
    hp INT DEFAULT 100,
    max_hp INT DEFAULT 100,
    exp INT DEFAULT 0,
    str INT DEFAULT 10
  )
`).then(() => console.log("DB 테이블 체크 완료"))
  .catch(err => console.error("DB 테이블 에러:", err));

// 👾 몬스터 도감 (나중에 더 추가 가능)
const monsters = [
  { name: "슬라임", hp: 30, atk: 5, exp: 5 },
  { name: "주황버섯", hp: 50, atk: 10, exp: 15 },
  { name: "돼지", hp: 80, atk: 15, exp: 30 },
  { name: "스톤골렘", hp: 200, atk: 40, exp: 100 }
];

let connectedPlayers = {};

io.on('connection', (socket) => {
  console.log(`접속: ${socket.id}`);

  // 1. 회원가입
  socket.on('req_register', async ({ id, pw }) => {
    try {
      const check = await pool.query('SELECT * FROM players WHERE name = $1', [id]);
      if (check.rows.length > 0) return socket.emit('login_fail', '이미 존재하는 닉네임입니다.');
      
      await pool.query('INSERT INTO players (name, password) VALUES ($1, $2)', [id, pw]);
      socket.emit('register_success', `가입 완료! 로그인해주세요.`);
    } catch (err) {
      console.error(err);
      socket.emit('login_fail', '회원가입 오류');
    }
  });

  // 2. 로그인
  socket.on('req_login', async ({ id, pw }) => {
    try {
      const res = await pool.query('SELECT * FROM players WHERE name = $1 AND password = $2', [id, pw]);
      if (res.rows.length > 0) {
        const player = res.rows[0];
        connectedPlayers[socket.id] = player;
        socket.emit('login_success', player);
        socket.emit('log_message', `[시스템] 환영합니다, ${player.name}님! (LV.${player.level})`);
      } else {
        socket.emit('login_fail', '아이디/비밀번호 오류');
      }
    } catch (err) {
      socket.emit('login_fail', '로그인 오류');
    }
  });

  // ⚔️ 3. 사냥하기 (핵심 기능!)
  socket.on('req_hunt', () => {
    const player = connectedPlayers[socket.id];
    if (!player) return;

    if (player.hp <= 0) {
      return socket.emit('log_message', `[전투] 체력이 없어 사냥할 수 없습니다!`);
    }

    // 랜덤 몬스터 출현
    const monsterIndex = Math.floor(Math.random() * monsters.length);
    const monster = monsters[monsterIndex];

    // 전투 계산 (간단 버전: 한 대 때리고 한 대 맞기)
    // 1. 플레이어 공격
    const damage = player.str || 10; // 공격력 (기본 10)
    
    // 2. 결과 판정
    let log = `[전투] ⚔️ ${monster.name}을(를) 공격해 ${damage}의 피해를 입혔습니다!`;
    
    if (damage >= monster.hp) {
      // 몬스터 처치!
      player.exp += monster.exp;
      log += ` (처치! +${monster.exp} EXP)`;
      
      // 레벨업 체크 (필요 경험치: 레벨 * 50)
      const maxExp = player.level * 50;
      if (player.exp >= maxExp) {
        player.level += 1;
        player.exp -= maxExp;
        player.max_hp += 20; // 체력통 증가
        player.hp = player.max_hp; // 레벨업 시 체력 회복
        player.str = (player.str || 10) + 5; // 공격력 증가
        log += ` ✨ 레벨업! (LV.${player.level})`;
      }
    } else {
      // 몬스터 반격
      player.hp -= monster.atk;
      log += ` 💢 ${monster.name}에게 ${monster.atk}의 피해를 입었습니다.`;
      if (player.hp < 0) player.hp = 0;
    }

    // 상태 업데이트 전송
    connectedPlayers[socket.id] = player;
    socket.emit('update_status', player);
    socket.emit('log_message', log);
  });

  // 💖 4. 휴식하기 (체력 회복)
  socket.on('req_rest', () => {
    const player = connectedPlayers[socket.id];
    if (!player) return;

    if (player.hp < player.max_hp) {
      player.hp = Math.min(player.hp + 10, player.max_hp);
      connectedPlayers[socket.id] = player;
      socket.emit('update_status', player);
      socket.emit('log_message', `[휴식] 💤 체력을 회복합니다. (HP: ${player.hp}/${player.max_hp})`);
    } else {
      socket.emit('log_message', `[시스템] 이미 체력이 가득 찼습니다.`);
    }
  });

  // 5. 연결 종료 (저장)
  socket.on('disconnect', async () => {
    const player = connectedPlayers[socket.id];
    if (player) {
      try {
        await pool.query(
          'UPDATE players SET level=$1, hp=$2, max_hp=$3, exp=$4, str=$5 WHERE name=$6',
          [player.level, player.hp, player.max_hp, player.exp, player.str || 10, player.name]
        );
        console.log(`${player.name} 저장 완료`);
      } catch (err) { console.error(err); }
      delete connectedPlayers[socket.id];
    }
  });
});

server.listen(process.env.PORT || 3001, () => {
  console.log('SERVER RUNNING');
});