import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import './App.css'; 

// 🚨 본인의 Railway 주소 확인 필수!
const socket = io.connect("https://mud-game-project-production.up.railway.app");

function App() {
  const [logs, setLogs] = useState([]);
  const [status, setStatus] = useState(null);
  const [mapList, setMapList] = useState([]); // 서버에서 받은 사냥터 목록
  const [currentMapId, setCurrentMapId] = useState(0); // 현재 내 위치

  const [inputId, setInputId] = useState("");
  const [inputPw, setInputPw] = useState("");
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAutoHunting, setIsAutoHunting] = useState(false);

  const autoLoginAttempted = useRef(false);
  const logEndRef = useRef(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // 자동 사냥 타이머
  useEffect(() => {
    let timer;
    if (isAutoHunting) {
      if (status && status.hp > 0) {
        timer = setTimeout(() => socket.emit('req_hunt'), 1000); 
      } else {
        setIsAutoHunting(false);
        alert("체력이 부족하여 자동 사냥 종료!");
      }
    }
    return () => clearTimeout(timer); 
  }, [isAutoHunting, status]); 

  // 서버 이벤트 리스너
  useEffect(() => {
    const handleLog = (msg) => setLogs((prev) => [...prev, msg]);
    const handleStatus = (data) => setStatus(data);
    
    // 로그인 성공 시 맵 목록도 같이 받음
    const handleLoginSuccess = ({ player, mapList }) => {
      setIsLoggedIn(true);
      setStatus(player);
      setMapList(mapList); // 맵 목록 저장
      localStorage.setItem('savedId', player.name);
      if (inputPw) localStorage.setItem('savedPw', inputPw);
    };

    // 맵 이동 성공 시
    const handleMapChanged = (newMapId) => {
      setCurrentMapId(newMapId);
    };

    socket.on('log_message', handleLog);
    socket.on('update_status', handleStatus);
    socket.on('login_success', handleLoginSuccess);
    socket.on('map_changed', handleMapChanged); // 리스너 추가
    socket.on('login_fail', (msg) => alert(msg));
    socket.on('register_success', (msg) => { alert(msg); setIsLoginMode(true); });

    return () => {
      socket.off('log_message', handleLog);
      socket.off('update_status', handleStatus);
      socket.off('login_success', handleLoginSuccess);
      socket.off('map_changed', handleMapChanged);
      socket.off('login_fail');
      socket.off('register_success');
    };
  }, [inputPw]);

  // 자동 로그인
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

  // 🗺️ 맵 이동 요청 함수
  const handleMoveMap = (mapId) => {
    socket.emit('req_move_map', mapId);
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
          {/* 좌측 패널: 상태창 + 이동 + 컨트롤 */}
          <div className="dashboard">
            
            {/* 1. 상태창 */}
            <div className="status-card">
              <div className="stat-row">
                <span style={{color:'#61afef', fontWeight:'bold'}}>{status?.name}</span>
                <span style={{color:'#e5c07b'}}>Lv.{status?.level}</span>
              </div>
              <div className="bar-bg"><div className="hp-bar" style={{width: `${(status?.hp/status?.max_hp)*100}%`}}></div></div>
              <div style={{fontSize:'12px', textAlign:'right', marginBottom:'5px'}}>{status?.hp} / {status?.max_hp}</div>
              <div className="bar-bg"><div className="exp-bar" style={{width: `${(status?.exp/(status?.level*50))*100}%`}}></div></div>
              <div style={{fontSize:'14px', marginTop:'10px'}}>⚔️ 공격력: <span style={{color:'#e06c75'}}>{status?.str}</span></div>
            </div>

            {/* 2. 사냥터 목록 (New!) */}
            <div className="status-card" style={{marginTop:'10px'}}>
              <div style={{color:'#98c379', fontWeight:'bold', marginBottom:'10px'}}>🗺️ 사냥터 이동</div>
              <div style={{display:'flex', flexDirection:'column', gap:'5px'}}>
                {mapList.map((map) => {
                  const canEnter = status.level >= map.minLevel;
                  const isCurrent = currentMapId === map.id;
                  return (
                    <button 
                      key={map.id}
                      onClick={() => handleMoveMap(map.id)}
                      disabled={!canEnter || isCurrent}
                      style={{
                        padding: '10px',
                        background: isCurrent ? '#e5c07b' : (canEnter ? '#3e4451' : '#21252b'),
                        color: isCurrent ? '#282c34' : (canEnter ? 'white' : '#555'),
                        border: isCurrent ? '2px solid #fff' : '1px solid #282c34',
                        cursor: canEnter ? 'pointer' : 'not-allowed',
                        textAlign: 'left',
                        borderRadius: '5px',
                        fontWeight: isCurrent ? 'bold' : 'normal'
                      }}
                    >
                      {map.name} <span style={{fontSize:'11px', float:'right'}}>Lv.{map.minLevel}+</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 3. 컨트롤 패널 */}
            <div className="control-panel" style={{marginTop:'10px'}}>
              <button 
                className="btn" 
                style={{
                  background: isAutoHunting ? '#e06c75' : 'linear-gradient(135deg, #e06c75, #c14650)',
                  border: isAutoHunting ? '2px solid white' : 'none',
                  animation: isAutoHunting ? 'pulse 1s infinite' : 'none'
                }} 
                onClick={toggleAutoHunt}
              >
                {isAutoHunting ? "⏹ 중지" : "⚔️ 자동사냥"}
              </button>
              <div style={{display:'flex', gap:'10px'}}>
                <button className="btn btn-rest" style={{flex:1}} onClick={handleRest}>💤 휴식</button>
                <button className="btn btn-out" style={{flex:1}} onClick={handleLogout}>나가기</button>
              </div>
            </div>
          </div>

          {/* 우측 패널: 로그창 */}
          <div className="log-window">
            {logs.map((log, idx) => (
              <div key={idx} style={{marginBottom:'5px'}}>
                 {log.includes('[전투]') ? <span className="text-battle">{log}</span> : 
                 log.includes('[시스템]') ? <span className="text-system">{log}</span> : 
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