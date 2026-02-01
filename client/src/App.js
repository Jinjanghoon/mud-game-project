import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import './App.css'; 

// 본인의 Railway 주소로 유지하세요!
const socket = io.connect("https://mud-game-project-production.up.railway.app");

function App() {
  const [logs, setLogs] = useState([]);
  const [status, setStatus] = useState(null);
  
  // 로그인 관련 상태
  const [inputId, setInputId] = useState("");
  const [inputPw, setInputPw] = useState("");
  const [isLoginMode, setIsLoginMode] = useState(true); // true면 로그인, false면 회원가입 화면
  const [isLoggedIn, setIsLoggedIn] = useState(false); // 로그인 성공 여부

  useEffect(() => {
    // 1. 서버에서 오는 로그 받기
    socket.on('log_message', (msg) => {
      setLogs((prev) => [...prev, msg]);
    });

    // 2. 내 정보 업데이트
    socket.on('update_status', (data) => {
      setStatus(data);
    });

    // 3. 로그인 성공 신호 받기
    socket.on('login_success', (data) => {
      setIsLoggedIn(true);
      setStatus(data);
      // ★ 자동 로그인을 위해 브라우저에 저장 (보안상 실제론 토큰을 써야 하지만 지금은 학습용!)
      localStorage.setItem('savedId', data.name);
      localStorage.setItem('savedPw', inputPw); // 비밀번호 기억
    });

    // 4. 로그인 실패/가입 성공 메시지
    socket.on('login_fail', (msg) => alert(msg));
    socket.on('register_success', (msg) => {
      alert(msg);
      setIsLoginMode(true); // 가입 성공하면 로그인 화면으로 전환
    });

    // ★ 5. 앱 켜자마자 자동 로그인 시도
    const savedId = localStorage.getItem('savedId');
    const savedPw = localStorage.getItem('savedPw');
    if (savedId && savedPw) {
      setInputId(savedId);
      setInputPw(savedPw); // 상태도 업데이트
      socket.emit('req_login', { id: savedId, pw: savedPw });
    }

  }, []);

  // 로그인 버튼 클릭
  const handleLogin = () => {
    if (!inputId || !inputPw) return alert("아이디와 비밀번호를 입력하세요.");
    socket.emit('req_login', { id: inputId, pw: inputPw });
  };

  // 회원가입 버튼 클릭
  const handleRegister = () => {
    if (!inputId || !inputPw) return alert("아이디와 비밀번호를 입력하세요.");
    socket.emit('req_register', { id: inputId, pw: inputPw });
  };

  // 로그아웃
  const handleLogout = () => {
    localStorage.removeItem('savedId');
    localStorage.removeItem('savedPw');
    window.location.reload();
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Courier New" }}>
      <h1>🌲 텍스트의 숲 (Live Ver)</h1>
      
      {!isLoggedIn ? (
        // [로그인/회원가입 화면]
        <div style={{ maxWidth: "300px", border: "1px solid #ccc", padding: "20px" }}>
          <h3>{isLoginMode ? "로그인" : "회원가입"}</h3>
          
          <input 
            placeholder="아이디 (닉네임)" 
            value={inputId}
            onChange={(e) => setInputId(e.target.value)}
            style={{ width: "90%", marginBottom: "10px", padding: "5px" }}
          /><br/>
          
          <input 
            type="password" 
            placeholder="비밀번호" 
            value={inputPw}
            onChange={(e) => setInputPw(e.target.value)}
            style={{ width: "90%", marginBottom: "10px", padding: "5px" }}
          /><br/>

          {isLoginMode ? (
            <>
              <button onClick={handleLogin} style={{ width: "100%", padding: "10px" }}>접속하기</button>
              <p style={{ fontSize: "12px", marginTop: "10px" }}>
                계정이 없으신가요? <span onClick={() => setIsLoginMode(false)} style={{ color: "blue", cursor: "pointer" }}>회원가입</span>
              </p>
            </>
          ) : (
            <>
              <button onClick={handleRegister} style={{ width: "100%", padding: "10px" }}>가입하기</button>
              <p style={{ fontSize: "12px", marginTop: "10px" }}>
                이미 계정이 있나요? <span onClick={() => setIsLoginMode(true)} style={{ color: "blue", cursor: "pointer" }}>로그인</span>
              </p>
            </>
          )}
        </div>
      ) : (
        // [게임 접속 후 화면]
        <div>
           {/* 상단 바 */}
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ border: "1px solid #ddd", padding: "10px", flexGrow: 1, marginRight: '10px' }}>
                <strong>[상태창]</strong> {status?.name} | LV: {status?.level} | HP: {status?.hp}
              </div>
              <button onClick={handleLogout} style={{ height: '40px' }}>로그아웃</button>
           </div>

          {/* 로그창 */}
          <div style={{ 
            border: "1px solid #333", 
            height: "400px", 
            overflowY: "scroll", 
            padding: "10px", 
            background: "#f4f4f4" 
          }}>
            {logs.map((log, idx) => (
              <div key={idx}>{log}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;