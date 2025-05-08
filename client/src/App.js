import React from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  // Navigate // Oda mantığına göre yönlendirme için kullanılabilir
} from 'react-router-dom';

// Sayfaları import et
import LoginPage from './pages/LoginPage';
import RoomPage from './pages/RoomPage';
// import NotFoundPage from './pages/NotFoundPage';

// Socket context'i import et
import { SocketProvider } from './contexts/SocketContext';

function App() {
  return (
    <SocketProvider>
      <Router>
        {/* Genel layout div'ini kaldırdık, çünkü LoginPage kendi tam sayfa arka planını yönetiyor */}
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/room/:roomId" element={<RoomPage />} />
          {/* <Route path="*" element={<NotFoundPage />} /> */}
        </Routes>
      </Router>
    </SocketProvider>
  );
}

// Geçici HomePage bileşenini kaldırdık veya yorum satırına aldık.

export default App; 