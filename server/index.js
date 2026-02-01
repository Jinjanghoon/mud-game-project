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

// ✅ DB 테이블 업데이트 (직업, 스텟포인트 추가)
pool.query(`
  CREATE TABLE IF NOT EXISTS players (
    name VARCHAR(50) PRIMARY KEY,
    password VARCHAR(255),
    level INT DEFAULT 1,
    hp INT DEFAULT 100,
    max_hp INT DEFAULT 100,
    exp INT DEFAULT 0,
    str INT DEFAULT 10,
    job VARCHAR(50) DEFAULT '초보자',
    stat_points INT DEFAULT 0
  )
`).then(() => {
  console.log("DB 테이블 체크 완료");
  // 기존 유저들을 위한 컬럼 추가 (에러 방지용)
  pool.query("ALTER TABLE players ADD COLUMN IF NOT EXISTS job VARCHAR(50) DEFAULT '초보자'");
  pool.query("ALTER TABLE players ADD COLUMN IF NOT EXISTS stat_points INT DEFAULT 0");
})
.catch(err => console.error("DB 테이블 에러:", err));

// 🗺️ 사냥터 및 몬스터 데이터 (밸런스 조정)
const huntingGrounds = [
  {
    id: 0,
    name: "🌱 초심자의 숲",
    minLevel: 1,
    monsters: [
      { id: 0, name: "슬라임", hp: 30, atk: 5, exp: 5 },
      { id: 1, name: "달팽이", hp: 40, atk: 8, exp: 7 },
      { id: 2, name: "주황버섯", hp: 50, atk: 12, exp: 10 }
    ]
  },
  {
    id: 1,
    name: "🌵 선인장 사막",
    minLevel: 10,
    monsters: [
      { id: 0, name: "사막여우", hp: 150, atk: 25, exp: 30 },
      { id: 1, name: "전갈", hp: 200, atk: 35, exp: 45 },
      { id: 2, name: "선인장", hp: 300, atk: 45, exp: 60 }
    ]
  },
  {
    id: 2,
    name: "🏰 저주받은 성",
    minLevel: 30,
    monsters: [
      { id: 0, name: "스켈레톤", hp: 800, atk: 80, exp: 150 },
      { id: 1, name: "가고일", hp: 1200, atk: 110, exp: 250 },
      { id: 2, name: "발록", hp: 3000, atk: 200, exp: 800 }
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
      // 기본 직업: 모험가
      await pool.query('INSERT INTO players (name, password, job) VALUES ($1, $2, $3)', [id, pw, '모험가']);
      socket.emit('register_success', `가입 완료! 로그인해주세요.`);
    } catch (err) { console.error(err); socket.emit('login_fail', '회원가입 오류'); }
  });

  // 2. 로그인
  socket.on('req_login', async ({ id, pw }) => {
    try {
      const res = await pool.query('SELECT * FROM players WHERE name = $1 AND password = $2', [id, pw]);
      if (res.rows.length > 0) {
        const player = res.rows[0];
        player.mapId = 0; // 접속 시 시작 마을
        connectedPlayers[socket.id] = player;
        
        socket.emit('login_success', { player, mapList: huntingGrounds });
        socket.emit('log_message', `[시스템] 환영합니다, ${player.job} ${player.name}님!`);
      } else {
        socket.emit('login_fail', '아이디/비밀번호 오류');
      }
    } catch (err) { socket.emit('login_fail', '로그인 오류'); }
  });

  // 🗺️ 맵 이동
  socket.on('req_move_map', (targetMapId) => {
    const player = connectedPlayers[socket.id];
    if (!player) return;
    const targetMap = huntingGrounds.find(map => map.id === targetMapId);
    
    if (player.level < targetMap.minLevel) {
      return socket.emit('log_message', `[시스템] ⛔ 레벨 ${targetMap.minLevel} 이상만 입장 가능합니다.`);
    }

    player.mapId = targetMapId;
    connectedPlayers[socket.id] = player;
    socket.emit('map_changed', targetMapId);
    socket.emit('log_message', `[이동] 🦶 '${targetMap.name}'에 도착했습니다.`);
  });

  // ⚔️ 몬스터 지정 사냥 (타겟팅)
  socket.on('req_hunt', (monsterIndex) => {
    const player = connectedPlayers[socket.id];
    if (!player) return;
    if (player.hp <= 0) return socket.emit('log_message', `[전투] 💀 체력이 없어 사냥할 수 없습니다.`);

    const currentMap = huntingGrounds.find(map => map.id === player.mapId) || huntingGrounds[0];
    
    // 클라이언트가 보낸 인덱스로 몬스터 찾기 (없으면 0번)
    const targetMonster = currentMap.monsters[monsterIndex] || currentMap.monsters[0];

    // 전투 계산
    const damage = player.str || 10;
    let log = `[전투] 🗡️ ${targetMonster.name}에게 ${damage}의 데미지!`;

    if (damage >= targetMonster.hp) {
      // 몬스터 처치
      player.exp += targetMonster.exp;
      log += ` (처치! +${targetMonster.exp} EXP)`;

      // 레벨업 로직
      const maxExp = player.level * 50;
      if (player.exp >= maxExp) {
        player.level += 1;
        player.exp -= maxExp;
        player.max_hp += 20;
        player.hp = player.max_hp;
        player.stat_points += 5; // ★ 스텟 포인트 지급!
        log += ` ✨ Level Up! (LV.${player.level}) 스텟 포인트 +5 획득!`;
      }
    } else {
      // 반격
      player.hp -= targetMonster.atk;
      log += ` 💢 ${targetMonster.atk}의 피해를 입었습니다.`;
      if (player.hp < 0) player.hp = 0;
    }

    connectedPlayers[socket.id] = player;
    socket.emit('update_status', player);
    socket.emit('log_message', log);
  });

  // 💪 스텟 올리기
  socket.on('req_stat_up', (statType) => {
    const player = connectedPlayers[socket.id];
    if (!player) return;

    if (player.stat_points > 0) {
      if (statType === 'str') {
        player.str += 1; // 공격력 1 증가
        player.stat_points -= 1;
        socket.emit('log_message', `[성장] 💪 공격력이 증가했습니다! (현재: ${player.str})`);
      }
      // 추후 hp, dex 등 추가 가능
      connectedPlayers[socket.id] = player;
      socket.emit('update_status', player);
    } else {
      socket.emit('log_message', `[시스템] 스텟 포인트가 부족합니다.`);
    }
  });

  // 휴식
  socket.on('req_rest', () => {
    const player = connectedPlayers[socket.id];
    if (player && player.hp < player.max_hp) {
      player.hp = Math.min(player.hp + 20, player.max_hp);
      connectedPlayers[socket.id] = player;
      socket.emit('update_status', player);
      socket.emit('log_message', `[휴식] 💤 체력을 회복합니다. (${player.hp}/${player.max_hp})`);
    }
  });

  // 저장
  socket.on('disconnect', async () => {
    const player = connectedPlayers[socket.id];
    if (player) {
      try {
        await pool.query(
          'UPDATE players SET level=$1, hp=$2, max_hp=$3, exp=$4, str=$5, stat_points=$6 WHERE name=$7',
          [player.level, player.hp, player.max_hp, player.exp, player.str, player.stat_points, player.name]
        );
        console.log(`${player.name} 저장 완료`);
      } catch (err) { console.error(err); }
      delete connectedPlayers[socket.id];
    }
  });
});

server.listen(process.env.PORT || 3001, () => console.log('SERVER RUNNING'));