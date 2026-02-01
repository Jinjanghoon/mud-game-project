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
  cors: { origin: "*", methods: ["GET", "POST"] }
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

// 🗺️ 사냥터 및 몬스터 데이터 (여기를 수정해서 밸런스 조절!)
const huntingGrounds = [
  {
    id: 0,
    name: "🌱 초심자의 숲",
    minLevel: 1,
    monsters: [
      { name: "슬라임", hp: 30, atk: 5, exp: 5 },
      { name: "달팽이", hp: 40, atk: 8, exp: 7 },
      { name: "주황버섯", hp: 50, atk: 10, exp: 10 }
    ]
  },
  {
    id: 1,
    name: "🏜️ 거친 황무지",
    minLevel: 10,
    monsters: [
      { name: "사막여우", hp: 150, atk: 25, exp: 30 },
      { name: "전갈", hp: 200, atk: 35, exp: 45 },
      { name: "선인장", hp: 250, atk: 40, exp: 50 }
    ]
  },
  {
    id: 2,
    name: "💀 해골의 지하감옥",
    minLevel: 30,
    monsters: [
      { name: "스켈레톤", hp: 800, atk: 80, exp: 150 },
      { name: "좀비", hp: 1000, atk: 90, exp: 200 },
      { name: "유령", hp: 900, atk: 110, exp: 220 }
    ]
  },
  {
    id: 3,
    name: "🔥 악마의 성",
    minLevel: 50,
    monsters: [
      { name: "가고일", hp: 3000, atk: 200, exp: 800 },
      { name: "발록", hp: 5000, atk: 300, exp: 1500 },
      { name: "레드 드래곤", hp: 10000, atk: 500, exp: 3000 }
    ]
  }
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
    } catch (err) { socket.emit('login_fail', '회원가입 오류'); }
  });

  // 2. 로그인
  socket.on('req_login', async ({ id, pw }) => {
    try {
      const res = await pool.query('SELECT * FROM players WHERE name = $1 AND password = $2', [id, pw]);
      if (res.rows.length > 0) {
        const player = res.rows[0];
        
        // 로그인 시 기본 위치는 '초심자의 숲(0)'으로 설정 (메모리에만 저장)
        player.mapId = 0; 
        
        connectedPlayers[socket.id] = player;
        socket.emit('login_success', { player, mapList: huntingGrounds }); // 맵 목록도 같이 보냄
        socket.emit('log_message', `[시스템] 환영합니다, ${player.name}님! (LV.${player.level})`);
        socket.emit('log_message', `[이동] 현재 위치: ${huntingGrounds[0].name}`);
      } else {
        socket.emit('login_fail', '아이디/비밀번호 오류');
      }
    } catch (err) { socket.emit('login_fail', '로그인 오류'); }
  });

  // 🏃 3. 사냥터 이동 (New!)
  socket.on('req_move_map', (targetMapId) => {
    const player = connectedPlayers[socket.id];
    if (!player) return;

    const targetMap = huntingGrounds.find(map => map.id === targetMapId);
    
    // 레벨 제한 체크
    if (player.level < targetMap.minLevel) {
      return socket.emit('log_message', `[경고] ⛔ 레벨 ${targetMap.minLevel} 이상만 입장할 수 있습니다!`);
    }

    // 이동 처리
    player.mapId = targetMapId;
    connectedPlayers[socket.id] = player;
    
    socket.emit('map_changed', targetMapId); // 클라이언트 UI 업데이트용
    socket.emit('log_message', `[이동] 🦶 '${targetMap.name}'으로 이동했습니다.`);
  });

  // ⚔️ 4. 사냥하기 (위치 기반)
  socket.on('req_hunt', () => {
    const player = connectedPlayers[socket.id];
    if (!player) return;

    if (player.hp <= 0) return socket.emit('log_message', `[전투] 💀 체력이 없어 사냥 불가!`);

    // 현재 위치한 맵의 몬스터 목록 가져오기
    const currentMap = huntingGrounds.find(map => map.id === player.mapId) || huntingGrounds[0];
    const monsters = currentMap.monsters;
    
    // 랜덤 몬스터 출현
    const monster = monsters[Math.floor(Math.random() * monsters.length)];

    // 전투 계산
    const damage = player.str || 10;
    let log = `[전투] ⚔️ ${monster.name}(을)를 공격해 ${damage} 피해!`;
    
    if (damage >= monster.hp) {
      player.exp += monster.exp;
      log += ` (처치! +${monster.exp} EXP)`;
      
      const maxExp = player.level * 50;
      if (player.exp >= maxExp) {
        player.level += 1;
        player.exp -= maxExp;
        player.max_hp += 20;
        player.hp = player.max_hp;
        player.str = (player.str || 10) + 5;
        log += ` ✨ Level Up! (LV.${player.level})`;
      }
    } else {
      player.hp -= monster.atk;
      log += ` 💢 반격당해 ${monster.atk} 피해.`;
      if (player.hp < 0) player.hp = 0;
    }

    connectedPlayers[socket.id] = player;
    socket.emit('update_status', player);
    socket.emit('log_message', log);
  });

  // 5. 휴식
  socket.on('req_rest', () => {
    const player = connectedPlayers[socket.id];
    if (player && player.hp < player.max_hp) {
      player.hp = Math.min(player.hp + 20, player.max_hp); // 휴식 효율 증가
      connectedPlayers[socket.id] = player;
      socket.emit('update_status', player);
      socket.emit('log_message', `[휴식] 💤 체력 회복 중... (${player.hp}/${player.max_hp})`);
    }
  });

  // 6. 종료 및 저장
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

server.listen(process.env.PORT || 3001, () => console.log('SERVER RUNNING'));