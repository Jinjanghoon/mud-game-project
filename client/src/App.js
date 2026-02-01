import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import './App.css'; 

// 🚨 본인의 Railway 주소 확인!
const socket = io.connect("https://mud-game-project-production.up.railway.app");

function App() {
  const [logs, setLogs] = useState([]);
  const [status, setStatus] = useState(null);
  const [inputId, setInputId] = useState("");
  const [inputPw, setInputPw] = useState("");
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // 🤖 자동 사냥 상태
  const [isAutoHunting, setIsAutoHunting] = useState(false);

  const logEndRef = useRef(null);

  // 로그 자동 스크롤
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // 🤖 자동 사냥 로직
  useEffect(() => {
    let timer;
    if (isAutoHunting) {
      if (status && status.hp > 0) {
        timer = setTimeout(() => {
          socket.emit('req_hunt'); 
        }, 1000); 
      } else {
        setIsAutoHunting(false);
        alert("체력이 부족하여 자동 사냥을 종료합니다.");
      }
    }
    return () => clearTimeout(timer); 
  }, [isAutoHunting, status]); 

  // 👂 [핵심 수정] 서버 메시지 듣는 리스너 (딱 1번만 실행되게 수정함)
  useEffect(() => {
    // 1. 이벤트 핸들러 정의
    const handleLog = (msg) => setLogs((prev) => [...prev, msg]);
    const handleStatus = (data) => setStatus(data);
    const handleLoginSuccess = (data) => {
      setIsLoggedIn(true);
      setStatus(data);
      localStorage.setItem('savedId', data.name);
      // 비밀번호는 inputPw 상태가 아니라 로컬스토리지 값을 우선시해야 함 (여기선 간단히 처리)
    };
    const handleLoginFail = (msg) => alert(msg);
    const handleRegisterSuccess = (msg) => { alert(msg); setIsLoginMode(true); };

    // 2. 리스너 등록 (귀 열기)
    socket.on('log_message', handleLog);
    socket.on('update_status', handleStatus);
    socket.on('login_success', handleLoginSuccess);
    socket.on('login_fail', handleLoginFail);
    socket.on('register_success', handleRegisterSuccess);

    // 3. 뒷정리 함수 (귀 닫기) - 컴포넌트가 사라지거나 재실행될 때 중복 방지
    return () => {
      socket.off('log_message', handleLog);
      socket.off('update_status', handleStatus);
      socket.off('login_success', handleLoginSuccess);
      socket.off('login_fail', handleLoginFail);
      socket.off('register_success', handleRegisterSuccess);
    };
  }, []); // ✅ 여기가 비어있어야([]), 처음에 딱 한 번만 실행됨!

  // 앱 켜자마자 자동 로그인 시도 (별도 useEffect로 분리)
  useEffect(() => {
    const savedId = localStorage.getItem('savedId');
    const savedPw = localStorage.getItem('savedPw');
    if (savedId && savedPw) {
      setInputId(savedId);
      setInputPw(savedPw);
      socket.emit('req_login', { id: savedId, pw: savedPw });
    }
  }, []);

  const handleLogin = () => {
    // 로그인 성공 시에만 저장하도록 로직 변경 필요하지만, 편의상 여기서 저장
    localStorage.setItem('savedPw', inputPw); 
    socket.emit('req_login', { id: inputId, pw: inputPw });
  };
  
  const handleRegister = () => socket.emit('req_register', { id: inputId, pw: inputPw });
  
  const toggleAutoHunt = () => {
    if (status?.hp <= 0) return alert("체력이 부족합니다! 휴식하세요.");
    setIsAutoHunting(!isAutoHunting);
  };

  const handleRest = () => socket.emit('req_rest');
  
  const handleLogout = () => {
    localStorage.removeItem('savedId');
    localStorage.removeItem('savedPw');
    window.location.reload();
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1 className="title">TEXT FOREST ONLINE</h1>
      </header>

      {!isLoggedIn ? (
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
        <div className="game-layout">
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
              <button 
                className="btn" 
                style={{
                  background: isAutoHunting ? '#e06c75' : 'linear-gradient(135deg, #e06c75, #c14650)',
                  border: isAutoHunting ? '2px solid white' : 'none',
                  animation: isAutoHunting ? 'pulse 1s infinite' : 'none'
                }} 
                onClick={toggleAutoHunt}
              >
                {isAutoHunting ? "⏹ 자동사냥 중지 (ON)" : "⚔️ 자동사냥 시작 (OFF)"}
              </button>

              <button className="btn btn-rest" onClick={handleRest}>💤 휴식하기</button>
              <button className="btn btn-out" onClick={handleLogout}>로그아웃</button>
            </div>
          </div>

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