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

// ✅ DB 테이블 (직업, 스텟포인트 포함)
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
  pool.query("ALTER TABLE players ADD COLUMN IF NOT EXISTS job VARCHAR(50) DEFAULT '초보자'");
  pool.query("ALTER TABLE players ADD COLUMN IF NOT EXISTS stat_points INT DEFAULT 0");
}).catch(err => console.error("DB 테이블 에러:", err));

// 🗺️ 사냥터 데이터
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
        player.mapId = 0; // 시작 위치
        player.combat = null; // ★ 전투 상태 초기화
        
        connectedPlayers[socket.id] = player;
        socket.emit('login_success', { player, mapList: huntingGrounds });
        socket.emit('log_message', `[시스템] 환영합니다, ${player.job} ${player.name}님!`);
      } else {
        socket.emit('login_fail', '아이디/비밀번호 오류');
      }
    } catch (err) { socket.emit('login_fail', '로그인 오류'); }
  });

  // 3. 맵 이동
  socket.on('req_move_map', (targetMapId) => {
    const player = connectedPlayers[socket.id];
    if (!player) return;
    const targetMap = huntingGrounds.find(map => map.id === targetMapId);
    
    if (player.level < targetMap.minLevel) {
      return socket.emit('log_message', `[시스템] ⛔ 레벨 ${targetMap.minLevel} 이상만 입장 가능합니다.`);
    }

    player.mapId = targetMapId;
    player.combat = null; // 맵 이동 시 전투 중단
    connectedPlayers[socket.id] = player;
    
    socket.emit('map_changed', targetMapId);
    socket.emit('log_message', `[이동] 🦶 '${targetMap.name}'에 도착했습니다.`);
  });

  // ⚔️ 4. 사냥하기 (수정된 핵심 로직!)
  socket.on('req_hunt', (monsterIndex) => {
    const player = connectedPlayers[socket.id];
    if (!player) return;
    if (player.hp <= 0) return socket.emit('log_message', `[전투] 💀 기절 상태입니다. 휴식하세요.`);

    const currentMap = huntingGrounds.find(map => map.id === player.mapId) || huntingGrounds[0];
    const targetInfo = currentMap.monsters[monsterIndex] || currentMap.monsters[0];

    // ★ 전투 인스턴스 확인 (지금 싸우던 놈인가? 아니면 새 놈인가?)
    if (!player.combat || player.combat.monsterId !== targetInfo.id || player.combat.mapId !== currentMap.id) {
      // 새로운 몬스터 등장!
      player.combat = {
        mapId: currentMap.id,
        monsterId: targetInfo.id,
        name: targetInfo.name,
        hp: targetInfo.hp, // 현재 체력
        max_hp: targetInfo.hp,
        atk: targetInfo.atk,
        exp: targetInfo.exp
      };
      socket.emit('log_message', `[전투] ⚠️ 야생의 ${player.combat.name}(이)가 나타났다! (HP: ${player.combat.hp})`);
    }

    // 플레이어 공격
    const damage = player.str || 10;
    player.combat.hp -= damage; // 몬스터 체력 깎기

    let log = `[전투] 🗡️ ${player.combat.name}에게 ${damage} 피해!`;

    // 몬스터 사망 체크
    if (player.combat.hp <= 0) {
      log += ` (처치! +${player.combat.exp} EXP)`;
      
      // 경험치 및 레벨업 처리
      player.exp += player.combat.exp;
      player.combat = null; // 전투 종료 (적 사라짐)

      const maxExp = player.level * 50;
      if (player.exp >= maxExp) {
        player.level += 1;
        player.exp -= maxExp;
        player.max_hp += 20;
        player.hp = player.max_hp;
        player.stat_points += 5;
        log += ` ✨ Level Up! (LV.${player.level})`;
      }
    } else {
      // 몬스터 반격 (아직 살아있음)
      log += ` (적 HP: ${player.combat.hp}/${player.combat.max_hp})`;
      player.hp -= player.combat.atk;
      log += ` 💢 ${player.combat.atk} 반격 피해.`;
      
      if (player.hp < 0) player.hp = 0;
    }

    connectedPlayers[socket.id] = player;
    socket.emit('update_status', player);
    socket.emit('log_message', log);
  });

  // 5. 스텟 업
  socket.on('req_stat_up', (statType) => {
    const player = connectedPlayers[socket.id];
    if (player && player.stat_points > 0 && statType === 'str') {
      player.str += 1;
      player.stat_points -= 1;
      socket.emit('log_message', `[성장] 💪 공격력 증가! (현재: ${player.str})`);
      connectedPlayers[socket.id] = player;
      socket.emit('update_status', player);
    }
  });

  // 6. 휴식
  socket.on('req_rest', () => {
    const player = connectedPlayers[socket.id];
    if (player && player.hp < player.max_hp) {
      player.hp = Math.min(player.hp + 20, player.max_hp);
      connectedPlayers[socket.id] = player;
      socket.emit('update_status', player);
      socket.emit('log_message', `[휴식] 💤 체력 회복 중... (${player.hp}/${player.max_hp})`);
    }
  });

  // 7. 종료 및 저장
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