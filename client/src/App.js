import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import './App.css'; 

// ✅ 본인의 Railway 주소 확인!
const socket = io.connect("https://mud-game-project-production.up.railway.app");

function App() {
  const [logs, setLogs] = useState([]);
  const [status, setStatus] = useState(null);
  const [inputId, setInputId] = useState("");
  const [inputPw, setInputPw] = useState("");
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const logEndRef = useRef(null);

  // 로그 자동 스크롤
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

  const handleLogin = () => {
    if (!inputId || !inputPw) return alert("입력 정보가 부족합니다.");
    socket.emit('req_login', { id: inputId, pw: inputPw });
  };

  const handleRegister = () => {
    if (!inputId || !inputPw) return alert("입력 정보가 부족합니다.");
    socket.emit('req_register', { id: inputId, pw: inputPw });
  };

  const handleHunt = () => socket.emit('req_hunt');
  const handleRest = () => socket.emit('req_rest');
  const handleLogout = () => {
    localStorage.removeItem('savedId');
    localStorage.removeItem('savedPw');
    window.location.reload();
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1 className="title">🌲 텍스트의 숲 Online</h1>
      </header>

      {!isLoggedIn ? (
        // [로그인 화면]
        <div className="login-wrapper">
          <div className="login-box">
            <h2 style={{color:'white', margin:'0 0 20px 0'}}>
              {isLoginMode ? "모험 시작" : "캐릭터 생성"}
            </h2>
            <input 
              placeholder="닉네임 (ID)" 
              value={inputId}
              onChange={(e) => setInputId(e.target.value)}
            />
            <input 
              type="password" 
              placeholder="비밀번호 (PW)" 
              value={inputPw}
              onChange={(e) => setInputPw(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (isLoginMode ? handleLogin() : handleRegister())}
            />

            {isLoginMode ? (
              <>
                <button className="btn btn-atk" style={{width:'100%', marginTop:'10px'}} onClick={handleLogin}>접속하기</button>
                <p onClick={() => setIsLoginMode(false)} className="text-link" style={{marginTop:'15px'}}>
                  처음이신가요? 회원가입
                </p>
              </>
            ) : (
              <>
                <button className="btn btn-rest" style={{width:'100%', marginTop:'10px'}} onClick={handleRegister}>가입하기</button>
                <p onClick={() => setIsLoginMode(true)} className="text-link" style={{marginTop:'15px'}}>
                  이미 계정이 있나요? 로그인
                </p>
              </>
            )}
          </div>
        </div>
      ) : (
        // [인게임 화면 - 반응형 레이아웃]
        <div className="game-layout">
          {/* 좌측 패널: 대시보드 */}
          <div className="dashboard">
            <div className="status-card">
              <div className="stat-row">
                <span style={{color:'#61afef'}}>{status?.name}</span>
                <span style={{color:'#e5c07b'}}>Lv.{status?.level}</span>
              </div>
              
              <div style={{fontSize:'12px', color:'#aaa', marginBottom:'2px'}}>HP</div>
              <div className="bar-bg">
                <div className="hp-bar" style={{width: `${(status?.hp / status?.max_hp) * 100}%`}}></div>
              </div>
              <div style={{textAlign:'right', fontSize:'12px', marginBottom:'10px'}}>{status?.hp} / {status?.max_hp}</div>

              <div style={{fontSize:'12px', color:'#aaa', marginBottom:'2px'}}>EXP</div>
              <div className="bar-bg">
                <div className="exp-bar" style={{width: `${(status?.exp / (status?.level * 50)) * 100}%`}}></div>
              </div>

              <div style={{marginTop:'20px', fontSize:'14px'}}>
                ⚔️ 공격력: <span style={{color:'#e06c75', fontWeight:'bold'}}>{status?.str || 10}</span>
              </div>
            </div>

            {/* PC에서는 좌측, 모바일에서는 하단에 위치할 버튼들 */}
            <div className="control-panel">
              <button className="btn btn-atk" onClick={handleHunt}>⚔️ 사냥하기</button>
              <button className="btn btn-rest" onClick={handleRest}>💤 휴식하기</button>
              <button className="btn btn-out" onClick={handleLogout} style={{gridColumn:'span 2'}}>로그아웃</button>
            </div>
          </div>

          {/* 우측 패널: 로그창 */}
          <div className="log-window">
            {logs.length === 0 && <div style={{textAlign:'center', color:'#555', marginTop:'50px'}}>- 모험의 기록이 여기에 표시됩니다 -</div>}
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