import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import './App.css'; // 기본 스타일

// 로컬 테스트용 주소 (배포 후엔 실제 서버 주소로 변경)
const socket = io.connect("http://localhost:3001");

function App() {
  const [logs, setLogs] = useState([]);
  const [status, setStatus] = useState(null);
  const [nickname, setNickname] = useState("");
  const [isJoined, setIsJoined] = useState(false);

  useEffect(() => {
    // 서버에서 로그가 오면 화면에 추가
    socket.on('log_message', (msg) => {
      setLogs((prev) => [...prev, msg]);
    });

    // 내 스탯 정보 갱신
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
      <h1>🌲 텍스트의 숲 (Dev Ver)</h1>
      
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