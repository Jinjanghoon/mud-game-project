import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import './App.css'; 

// 🚨 Railway 주소 확인!
const socket = io.connect("https://mud-game-project-production.up.railway.app");

function App() {
  const [logs, setLogs] = useState([]);
  const [status, setStatus] = useState(null);
  const [mapList, setMapList] = useState([]); 
  const [currentMapId, setCurrentMapId] = useState(0); 
  const [targetMonsterIdx, setTargetMonsterIdx] = useState(0);

  const [inputId, setInputId] = useState("");
  const [inputPw, setInputPw] = useState("");
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAutoHunting, setIsAutoHunting] = useState(false);

  const inputPwRef = useRef("");
  const autoLoginAttempted = useRef(false);
  const logEndRef = useRef(null);

  useEffect(() => { inputPwRef.current = inputPw; }, [inputPw]);
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [logs]);

  // 🤖 자동 사냥
  useEffect(() => {
    let timer;
    if (isAutoHunting) {
      if (status && status.hp > 0) {
        timer = setTimeout(() => {
          socket.emit('req_hunt', targetMonsterIdx);
        }, 1000); 
      } else {
        setIsAutoHunting(false);
        alert("체력이 부족하여 자동 사냥 종료!");
      }
    }
    return () => clearTimeout(timer); 
  }, [isAutoHunting, status, targetMonsterIdx]);

  // 👂 이벤트 리스너
  useEffect(() => {
    socket.off('log_message');
    socket.off('update_status');
    socket.off('login_success');
    socket.off('map_changed');
    socket.off('login_fail');
    socket.off('register_success');

    const handleLog = (msg) => setLogs((prev) => [...prev, msg]);
    const handleStatus = (data) => setStatus(data);
    const handleLoginSuccess = ({ player, mapList }) => {
      setIsLoggedIn(true);
      setStatus(player);
      setMapList(mapList);
      localStorage.setItem('savedId', player.name);
      if (inputPwRef.current) localStorage.setItem('savedPw', inputPwRef.current);
    };
    const handleMapChanged = (newMapId) => {
      setCurrentMapId(newMapId);
      setTargetMonsterIdx(0);
      setIsAutoHunting(false);
    };

    socket.on('log_message', handleLog);
    socket.on('update_status', handleStatus);
    socket.on('login_success', handleLoginSuccess);
    socket.on('map_changed', handleMapChanged);
    socket.on('login_fail', (msg) => alert(msg));
    socket.on('register_success', (msg) => { alert(msg); setIsLoginMode(true); });

    return () => {
      socket.off('log_message');
      socket.off('update_status');
      socket.off('login_success');
      socket.off('map_changed');
      socket.off('login_fail');
      socket.off('register_success');
    };
  }, []);

  useEffect(() => {
    if (autoLoginAttempted.current) return;
    const savedId = localStorage.getItem('savedId');
    const savedPw = localStorage.getItem('savedPw');
    if (savedId && savedPw) {
      setInputId(savedId);
      setInputPw(savedPw);
      socket.emit('req_login', { id: savedId, pw: savedPw });
      autoLoginAttempted.current = true;
    }
  }, []);

  const handleLogin = () => socket.emit('req_login', { id: inputId, pw: inputPw });
  const handleRegister = () => socket.emit('req_register', { id: inputId, pw: inputPw });
  const toggleAutoHunt = () => {
    if (status?.hp <= 0) return alert("체력 부족!");
    setIsAutoHunting(!isAutoHunting);
  };
  const handleRest = () => socket.emit('req_rest');
  const handleLogout = () => {
    localStorage.removeItem('savedId');
    localStorage.removeItem('savedPw');
    window.location.reload();
  };
  const handleMoveMap = (mapId) => socket.emit('req_move_map', mapId);
  const handleStatUp = () => socket.emit('req_stat_up', 'str');
  const handleMonsterClick = (idx) => {
    setTargetMonsterIdx(idx);
    socket.emit('req_hunt', idx);
  };
  const currentMap = mapList.find(m => m.id === currentMapId);

  // ★ 퍼센트 계산 도우미 함수 ★
  const getHpPercent = () => {
    if (!status) return 0;
    return Math.floor((status.hp / status.max_hp) * 100);
  };

  const getExpPercent = () => {
    if (!status) return 0;
    const maxExp = status.level * 50; // 서버 규칙과 동일하게
    return Math.floor((status.exp / maxExp) * 100);
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1 className="title">TEXT FOREST ONLINE</h1>
      </header>

      {!isLoggedIn ? (
        <div className="login-wrapper">
          <div className="login-box">
            <h2 style={{color:'white', marginBottom:'20px'}}>
              {isLoginMode ? "ADVENTURE START" : "NEW CHARACTER"}
            </h2>
            <input placeholder="ID" value={inputId} onChange={(e)=>setInputId(e.target.value)} />
            <input type="password" placeholder="PW" value={inputPw} onChange={(e)=>setInputPw(e.target.value)} 
              onKeyDown={(e) => e.key === 'Enter' && (isLoginMode ? handleLogin() : handleRegister())}
            />
            {isLoginMode ? (
              <>
                <button className="btn btn-atk" style={{marginTop:'15px'}} onClick={handleLogin}>접속하기</button>
                <span onClick={()=>setIsLoginMode(false)} className="text-link">회원가입</span>
              </>
            ) : (
              <>
                <button className="btn btn-rest" style={{marginTop:'15px'}} onClick={handleRegister}>가입하기</button>
                <span onClick={()=>setIsLoginMode(true)} className="text-link">로그인</span>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="game-layout">
          <div className="dashboard">
            
            {/* 상태창 */}
            <div className="status-card">
              <div className="stat-row">
                <span style={{color:'#61afef', fontWeight:'bold'}}>{status?.name}</span>
                <span style={{color:'#98c379', fontSize:'0.9rem'}}>{status?.job || '모험가'}</span>
              </div>
              <div style={{color:'#e5c07b', fontWeight:'bold', marginBottom:'10px'}}>Lv.{status?.level}</div>
              
              {/* ❤️ HP 게이지 */}
              <div style={{fontSize:'12px', color:'#ccc', marginBottom:'2px'}}>HP</div>
              <div className="bar-container">
                <div className="hp-bar" style={{width: `${getHpPercent()}%`}}></div>
                <div className="bar-text">
                  {status?.hp} / {status?.max_hp} ({getHpPercent()}%)
                </div>
              </div>

              {/* ⭐ EXP 게이지 */}
              <div style={{fontSize:'12px', color:'#ccc', marginBottom:'2px'}}>EXP</div>
              <div className="bar-container">
                <div className="exp-bar" style={{width: `${getExpPercent()}%`}}></div>
                <div className="bar-text">
                  {getExpPercent()}% ({status?.exp} / {status?.level * 50})
                </div>
              </div>

              {/* 스텟 강화 UI */}
              <div style={{marginTop:'15px', borderTop:'1px solid #3e4451', paddingTop:'15px'}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                   <span>⚔️ 공격력: <span style={{color:'#e06c75', fontWeight:'bold'}}>{status?.str}</span></span>
                   {status?.stat_points > 0 && (
                     <button 
                       onClick={handleStatUp}
                       style={{padding:'4px 10px', background:'#e5c07b', border:'none', borderRadius:'6px', cursor:'pointer', fontWeight:'bold', color:'#282c34'}}
                     >+ 강화</button>
                   )}
                </div>
                {status?.stat_points > 0 && (
                  <div style={{color:'#e5c07b', fontSize:'12px', marginTop:'5px', textAlign:'right'}}>✨ 남은 포인트: {status?.stat_points}</div>
                )}
              </div>
            </div>

            {/* 사냥터 & 몬스터 목록 */}
            <div className="status-card" style={{marginTop:'10px', flex:1, display:'flex', flexDirection:'column'}}>
              <div style={{display:'flex', gap:'5px', overflowX:'auto', paddingBottom:'10px', marginBottom:'10px', borderBottom:'1px solid #3e4451'}}>
                {mapList.map((map) => (
                  <button 
                    key={map.id}
                    onClick={() => handleMoveMap(map.id)}
                    disabled={status.level < map.minLevel}
                    style={{
                      whiteSpace: 'nowrap',
                      padding: '8px 12px',
                      background: currentMapId === map.id ? '#61afef' : '#21252b',
                      color: currentMapId === map.id ? 'white' : '#aaa',
                      border: '1px solid #3e4451',
                      borderRadius: '20px',
                      cursor: status.level < map.minLevel ? 'not-allowed' : 'pointer',
                      opacity: status.level < map.minLevel ? 0.5 : 1
                    }}
                  >
                    {map.name}
                  </button>
                ))}
              </div>

              <div style={{color:'#fff', marginBottom:'5px', fontSize:'14px'}}>👹 몬스터 선택</div>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', overflowY:'auto', maxHeight:'200px'}}>
                {currentMap?.monsters.map((mon, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleMonsterClick(idx)}
                    style={{
                      padding: '15px',
                      background: targetMonsterIdx === idx ? 'linear-gradient(135deg, #e06c75, #c14650)' : '#2c313a',
                      border: targetMonsterIdx === idx ? '2px solid #fff' : '1px solid #3e4451',
                      borderRadius: '8px',
                      color: 'white',
                      cursor: 'pointer',
                      textAlign: 'left',
                      boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                    }}
                  >
                    <div style={{fontWeight:'bold'}}>{mon.name}</div>
                    <div style={{fontSize:'11px', color:'#ccc'}}>HP: {mon.hp} / EXP: {mon.exp}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 컨트롤 */}
            <div className="control-panel" style={{marginTop:'10px'}}>
              <button 
                className="btn" 
                style={{
                  background: isAutoHunting ? '#e06c75' : '#444',
                  border: isAutoHunting ? '2px solid white' : 'none',
                  animation: isAutoHunting ? 'pulse 1s infinite' : 'none'
                }} 
                onClick={toggleAutoHunt}
              >
                {isAutoHunting ? "⏹ 자동사냥 중지" : "⚔️ 선택 몬스터 자동사냥"}
              </button>
              <div style={{display:'flex', gap:'10px'}}>
                <button className="btn btn-rest" style={{flex:1}} onClick={handleRest}>💤 휴식</button>
                <button className="btn btn-out" style={{flex:1}} onClick={handleLogout}>나가기</button>
              </div>
            </div>
          </div>

          <div className="log-window">
            {logs.map((log, idx) => (
              <div key={idx} style={{marginBottom:'5px'}}>
                 {log.includes('[전투]') ? <span className="text-battle">{log}</span> : 
                 log.includes('[시스템]') ? <span className="text-system">{log}</span> : 
                 log.includes('[성장]') ? <span style={{color:'#61afef', fontWeight:'bold'}}>{log}</span> :
                 log.includes('[이동]') ? <span style={{color:'#e5c07b'}}>{log}</span> :
                 log}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;