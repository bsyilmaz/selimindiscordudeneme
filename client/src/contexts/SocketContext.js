import React, { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';

const SocketContext = createContext();

export function useSocket() {
  return useContext(SocketContext);
}

// Backend sunucu URL'si
// Geliştirme ortamında localhost:3001, production'da Render backend URL'si olmalı.
// Bu URL'yi bir .env dosyasından almak daha iyi bir pratiktir.
const SERVER_URL = process.env.NODE_ENV === 'production' 
    ? process.env.REACT_APP_BACKEND_URL // Render'da bu ortam değişkenini ayarlamanız gerekecek
    : 'http://localhost:3001';

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Yeni bir socket bağlantısı oluştur
    // autoConnect: false ile manuel bağlantı kontrolü sağlanabilir,
    // ancak genellikle sayfa yüklenir yüklenmez bağlanması istenir.
    const newSocket = io(SERVER_URL, {
      // reconnectionAttempts: 5, // İsteğe bağlı: Yeniden bağlanma denemesi sayısı
      // transports: ['websocket'], // İsteğe bağlı: Sadece websocket kullanmaya zorla
    });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Socket.IO sunucusuna başarıyla bağlanıldı!', newSocket.id);
      setIsConnected(true);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Socket.IO sunucusundan bağlantı kesildi:', reason);
      setIsConnected(false);
      // İsteğe bağlı: Bağlantı kesildiğinde kullanıcıya bildirim gösterme
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket.IO bağlantı hatası:', error);
      // İsteğe bağlı: Bağlantı hatası durumunda kullanıcıya bildirim gösterme
      // Örneğin, sunucuya ulaşılamıyor mesajı.
    });

    // Bileşen kaldırıldığında socket bağlantısını kapat
    return () => {
      console.log('Socket bağlantısı kapatılıyor...');
      newSocket.disconnect();
      newSocket.off('connect');
      newSocket.off('disconnect');
      newSocket.off('connect_error');
      setSocket(null);
      setIsConnected(false);
    };
  }, []); // Sadece bileşen mount edildiğinde çalışır

  // Socket ve bağlantı durumu, alt bileşenler tarafından kullanılabilir
  const value = {
    socket,
    isConnected
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
} 