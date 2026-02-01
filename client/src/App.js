import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import './App.css'; 

// 🚨 본인의 Railway 주소 확인 필수!
const socket = io.connect("https://mud-game-project-production.up.railway.app");

function App() {
  const [logs, setLogs] = useState([]);
  const [status, setStatus] = useState(null);
  const [mapList, setMapList] = useState([]); 
  const [currentMapId, setCurrentMapId] = useState(0); 

  const [inputId, setInputId] = useState("");
  const [inputPw, setInputPw] = useState("");
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAutoHunting, setIsAutoHunting] = useState(false);

  // 🔄 최신 비밀번호 값을 리스너 안에서 쓰기 위한 Ref (중요!)
  const inputPwRef = useRef("");
  const autoLoginAttempted = useRef(false);
  const logEndRef = useRef(null);

  // 비밀번호 입력할 때마다 Ref에 최신값 동기화
  useEffect(() => {
    inputPwRef.current = inputPw;
  }, [inputPw]);

  // 로그 스크롤
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

  // 👂 [핵심] 서버 이벤트 리스너 (중복 방지 끝판왕)
  useEffect(() => {
    // 1. 기존에 붙어있던 리스너를 무조건 다 떼어냅니다. (초기화)
    socket.off('log_message');
    socket.off('update_status');
    socket.off('login_success');
    socket.off('map_changed');
    socket.off('login_fail');
    socket.off('register_success');

    // 2. 핸들러 정의
    const handleLog = (msg) => setLogs((prev) => [...prev, msg]);
    const handleStatus = (data) => setStatus(data);
    
    const handleLoginSuccess = ({ player, mapList }) => {
      setIsLoggedIn(true);
      setStatus(player);
      setMapList(mapList);
      
      // 로그인 성공 시 저장 (Ref 사용으로 중복 실행 방지하면서 최신값 저장)
      localStorage.setItem('savedId', player.name);
      if (inputPwRef.current) {
        localStorage.setItem('savedPw', inputPwRef.current);
      }
    };

    const handleMapChanged = (newMapId) => setCurrentMapId(newMapId);

    // 3. 리스너 등록 (딱 한 번만)
    socket.on('log_message', handleLog);
    socket.on('update_status', handleStatus);
    socket.on('login_success', handleLoginSuccess);
    socket.on('map_changed', handleMapChanged);
    socket.on('login_fail', (msg) => alert(msg));
    socket.on('register_success', (msg) => { alert(msg); setIsLoginMode(true); });

    // 4. 컴포넌트 사라질 때 청소
    return () => {
      socket.off('log_message');
      socket.off('update_status');
      socket.off('login_success');
      socket.off('map_changed');
      socket.off('login_fail');
      socket.off('register_success');
    };
  }, []); // ✅ 의존성 배열을 비워서([]), 처음에 딱 1번만 실행됨을 보장!

  // 자동 로그인 시도
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
          <div className="dashboard">
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