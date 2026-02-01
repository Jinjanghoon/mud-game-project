import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import './App.css'; 

// ✅ 여기가 핵심! 방금 따온 리얼 서버 주소입니다.
const socket = io.connect("https://mud-game-project-production.up.railway.app");

function App() {
  const [logs, setLogs] = useState([]);
  const [status, setStatus] = useState(null);
  const [nickname, setNickname] = useState("");
  const [isJoined, setIsJoined] = useState(false);

  useEffect(() => {
    socket.on('log_message', (msg) => {
      setLogs((prev) => [...prev, msg]);
    });

    socket.on('update_status', (data) => {
      setStatus(data);
    });
  }, []);

  const joinGame = () => {
    if (nickname !== "") {
      socket.emit('join_game', nickname);
      setIsJoined(true);
    }
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Courier New" }}>
      <h1>🌲 텍스트의 숲 (Live Ver)</h1>
      
      {!isJoined ? (
        <div>
          <input 
            placeholder="닉네임 입력" 
            onChange={(e) => setNickname(e.target.value)} 
          />
          <button onClick={joinGame}>입장하기</button>
        </div>
      ) : (
        <div>
          {/* 상태창 */}
          <div style={{ border: "1px solid #ddd", padding: "10px", marginBottom: "10px" }}>
            <strong>[상태창]</strong> <br/>
            이름: {status?.name} | LV: {status?.level} | HP: {status?.hp}
          </div>

          {/* 로그창 */}
          <div style={{ 
            border: "1px solid #333", 
            height: "300px", 
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