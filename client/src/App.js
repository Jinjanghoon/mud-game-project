import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import './App.css'; 

// 🚨 본인의 Railway 주소로 변경 확인!
const socket = io.connect("https://mud-game-project-production.up.railway.app");

function App() {
  const [logs, setLogs] = useState([]);
  const [status, setStatus] = useState(null);
  const [inputId, setInputId] = useState("");
  const [inputPw, setInputPw] = useState("");
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // 로그창 스크롤 자동 내리기용
  const logEndRef = useRef(null);

  const scrollToBottom = () => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [logs]);

  useEffect(() => {
    socket.on('log_message', (msg) => {
      setLogs((prev) => [...prev, msg]);
    });

    socket.on('update_status', (data) => {
      setStatus(data);
    });

    socket.on('login_success', (data) => {
      setIsLoggedIn(true);
      setStatus(data);
      localStorage.setItem('savedId', data.name);
      localStorage.setItem('savedPw', inputPw);
    });

    socket.on('login_fail', (msg) => alert(msg));
    
    socket.on('register_success', (msg) => {
      alert(msg);
      setIsLoginMode(true);
    });

    // 자동 로그인 시도
    const savedId = localStorage.getItem('savedId');
    const savedPw = localStorage.getItem('savedPw');
    if (savedId && savedPw) {
      setInputId(savedId);
      setInputPw(savedPw);
      socket.emit('req_login', { id: savedId, pw: savedPw });
    }
  }, [inputPw]); // inputPw가 바뀔 때마다가 아니라 초기 로딩시 1번만 실행되게 하려면 []가 맞지만, 자동로그인을 위해 의존성 조정

  const handleLogin = () => {
    if (!inputId || !inputPw) return alert("아이디/비번을 입력하세요.");
    socket.emit('req_login', { id: inputId, pw: inputPw });
  };

  const handleRegister = () => {
    if (!inputId || !inputPw) return alert("아이디/비번을 입력하세요.");
    socket.emit('req_register', { id: inputId, pw: inputPw });
  };

  // ⚔️ 사냥 버튼
  const handleHunt = () => {
    socket.emit('req_hunt');
  };

  // 💤 휴식 버튼
  const handleRest = () => {
    socket.emit('req_rest');
  };

  const handleLogout = () => {
    localStorage.removeItem('savedId');
    localStorage.removeItem('savedPw');
    window.location.reload();
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1 className="title">🌲 텍스트의 숲</h1>
      </header>

      {!isLoggedIn ? (
        // [로그인 화면]
        <div className="login-box">
          <h2 style={{color: '#fff'}}>{isLoginMode ? "모험 시작하기" : "새로운 영웅 등록"}</h2>
          <input 
            placeholder="닉네임 (ID)" 
            value={inputId}
            onChange={(e) => setInputId(e.target.value)}
          />
          <input 
            type="password" 
            placeholder="비밀번호" 
            value={inputPw}
            onChange={(e) => setInputPw(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (isLoginMode ? handleLogin() : handleRegister())}
          />

          {isLoginMode ? (
            <>
              <button className="btn-primary" onClick={handleLogin}>접속하기</button>
              <p onClick={() => setIsLoginMode(false)} className="text-link">
                계정이 없으신가요? 회원가입
              </p>
            </>
          ) : (
            <>
              <button className="btn-success" onClick={handleRegister}>가입하기</button>
              <p onClick={() => setIsLoginMode(true)} className="text-link">
                돌아가기
              </p>
            </>
          )}
        </div>
      ) : (
        // [인게임 화면]
        <div className="game-area">
          {/* 상태창 */}
          <div className="status-bar">
            <div style={{display:'flex', justifyContent:'space-between', color:'white', marginBottom:'5px'}}>
              <strong>Lv.{status?.level} {status?.name}</strong>
              <span>공격력: {status?.str || 10}</span>
            </div>
            
            {/* HP Bar */}
            <div className="bar-container">
              <div 
                className="hp-fill" 
                style={{width: `${(status?.hp / status?.max_hp) * 100}%`}}
              ></div>
              <div className="bar-text">{status?.hp} / {status?.max_hp} HP</div>
            </div>

            {/* EXP Bar (임시: 레벨*50 기준) */}
            <div className="bar-container" style={{height:'10px', marginTop:'5px'}}>
               <div 
                className="exp-fill" 
                style={{width: `${(status?.exp / (status?.level * 50)) * 100}%`}}
              ></div>
            </div>
          </div>

          {/* 로그창 */}
          <div className="log-window">
            {logs.map((log, idx) => (
              <div key={idx} style={{marginBottom: '5px'}}>
                {log.includes('[전투]') ? <span className="text-battle">{log}</span> : 
                 log.includes('[시스템]') ? <span className="text-system">{log}</span> : 
                 log}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>

          {/* 컨트롤 패널 */}
          <div className="control-panel">
            <button className="btn-danger" onClick={handleHunt}>⚔️ 사냥하기</button>
            <button className="btn-success" onClick={handleRest}>💤 휴식하기</button>
            <button className="btn-warning full-width" onClick={handleLogout}>로그아웃</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;