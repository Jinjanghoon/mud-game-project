import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import './App.css'; 

// 🚨 Railway 주소 확인!
const socket = io.connect("https://mud-game-project-production.up.railway.app");

function App() {
  const [logs, setLogs] = useState([]);
  const [status, setStatus] = useState(null);
  const [inputId, setInputId] = useState("");
  const [inputPw, setInputPw] = useState("");
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const logEndRef = useRef(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  useEffect(() => {
    socket.on('log_message', (msg) => setLogs((prev) => [...prev, msg]));
    socket.on('update_status', (data) => setStatus(data));
    socket.on('login_success', (data) => {
      setIsLoggedIn(true);
      setStatus(data);
      localStorage.setItem('savedId', data.name);
      localStorage.setItem('savedPw', inputPw);
    });
    socket.on('login_fail', (msg) => alert(msg));
    socket.on('register_success', (msg) => { alert(msg); setIsLoginMode(true); });

    const savedId = localStorage.getItem('savedId');
    const savedPw = localStorage.getItem('savedPw');
    if (savedId && savedPw) {
      setInputId(savedId);
      setInputPw(savedPw);
      socket.emit('req_login', { id: savedId, pw: savedPw });
    }
  }, [inputPw]);

  const handleLogin = () => socket.emit('req_login', { id: inputId, pw: inputPw });
  const handleRegister = () => socket.emit('req_register', { id: inputId, pw: inputPw });
  const handleHunt = () => socket.emit('req_hunt');
  const handleRest = () => socket.emit('req_rest');
  const handleLogout = () => {
    localStorage.removeItem('savedId');
    localStorage.removeItem('savedPw');
    window.location.reload();
  };

  return (
    <div className="app-container">
      {/* 헤더: 항상 화면 상단에 떠 있음 */}
      <header className="header">
        <h1 className="title">TEXT FOREST ONLINE</h1>
      </header>

      {!isLoggedIn ? (
        // [로그인 화면] - 박스 없이 전체 화면 중앙 배치
        <div className="login-wrapper">
          <div className="login-box">
            <h2 style={{color:'white', marginBottom:'10px', fontSize:'2rem'}}>
              {isLoginMode ? "ADVENTURE START" : "NEW CHARACTER"}
            </h2>
            
            <input 
              placeholder="NICKNAME" 
              value={inputId}
              onChange={(e) => setInputId(e.target.value)}
            />
            <input 
              type="password" 
              placeholder="PASSWORD" 
              value={inputPw}
              onChange={(e) => setInputPw(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (isLoginMode ? handleLogin() : handleRegister())}
            />

            {isLoginMode ? (
              <>
                <button className="btn btn-atk" style={{marginTop:'10px'}} onClick={handleLogin}>접속하기</button>
                <span onClick={() => setIsLoginMode(false)} className="text-link">
                  새로운 모험가이신가요? 회원가입
                </span>
              </>
            ) : (
              <>
                <button className="btn btn-rest" style={{marginTop:'10px'}} onClick={handleRegister}>등록하기</button>
                <span onClick={() => setIsLoginMode(true)} className="text-link">
                  이미 계정이 있으신가요? 로그인
                </span>
              </>
            )}
          </div>
        </div>
      ) : (
        // [인게임 화면] - PC에선 넓게, 모바일에선 꽉 차게
        <div className="game-layout">
          {/* 좌측: 상태창 + 컨트롤 */}
          <div className="dashboard">
            <div className="status-card">
              <div className="stat-row">
                <span style={{color:'#61afef', fontWeight:'bold'}}>{status?.name}</span>
                <span style={{color:'#e5c07b'}}>Lv.{status?.level}</span>
              </div>
              
              <div style={{fontSize:'12px', color:'#aaa', marginBottom:'4px'}}>HP ({status?.hp}/{status?.max_hp})</div>
              <div className="bar-bg">
                <div className="hp-bar" style={{width: `${(status?.hp / status?.max_hp) * 100}%`}}></div>
              </div>

              <div style={{fontSize:'12px', color:'#aaa', marginBottom:'4px'}}>EXP</div>
              <div className="bar-bg">
                <div className="exp-bar" style={{width: `${(status?.exp / (status?.level * 50)) * 100}%`}}></div>
              </div>

              <div style={{marginTop:'15px', borderTop:'1px solid #3e4451', paddingTop:'15px'}}>
                 공격력 <span style={{color:'#e06c75', float:'right', fontWeight:'bold'}}>{status?.str || 10}</span>
              </div>
            </div>

            <div className="control-panel" style={{display:'flex', flexDirection:'column', gap:'10px'}}>
              <button className="btn btn-atk" onClick={handleHunt}>⚔️ 사냥하기</button>
              <button className="btn btn-rest" onClick={handleRest}>💤 휴식하기</button>
              <button className="btn btn-out" onClick={handleLogout}>로그아웃</button>
            </div>
          </div>

          {/* 우측: 로그창 */}
          <div className="log-window">
            {logs.length === 0 && <div style={{textAlign:'center', color:'#555', marginTop:'100px'}}>- 모험의 기록이 여기에 표시됩니다 -</div>}
            {logs.map((log, idx) => (
              <div key={idx} style={{marginBottom: '8px'}}>
                 {log.includes('[전투]') ? <span className="text-battle">{log}</span> : 
                 log.includes('[시스템]') ? <span className="text-system">{log}</span> : 
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