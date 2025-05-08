import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext';
import { FiUsers, FiLock, FiLogIn } from 'react-icons/fi';

function LoginPage() {
  const [roomName, setRoomName] = useState('');
  const [roomPassword, setRoomPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const { socket, isConnected } = useSocket();
  const navigate = useNavigate();
  const [activeRooms, setActiveRooms] = useState([]);

  useEffect(() => {
    if (socket) {
      socket.on('join-room-error', setError);
      socket.on('joined-room', (data) => {
        console.log('Odaya başarıyla katınıldı:', data);
        navigate(`/room/${data.roomId}`);
      });
      socket.on('active-rooms-update', setActiveRooms);

      socket.emit('get-active-rooms');

      return () => {
        socket.off('join-room-error', setError);
        socket.off('joined-room');
        socket.off('active-rooms-update', setActiveRooms);
      };
    }
  }, [socket, navigate]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!roomName.trim() || !username.trim()) {
      setError('Oda adı ve kullanıcı adı boş bırakılamaz.');
      return;
    }
    if (!isConnected || !socket) {
      setError('Sunucuya bağlantı kurulamadı. Lütfen daha sonra tekrar deneyin.');
      return;
    }
    setError('');
    
    console.log('Odaya katılma isteği gönderiliyor:', { roomId: roomName, password: roomPassword, username });
    socket.emit('join-room', { roomId: roomName, password: roomPassword, username });
  };

  const handleRoomClick = (room) => {
    setRoomName(room.name);
    if (room.hasPassword) {
      setError(`'${room.name}' odası şifreli. Lütfen şifreyi girin.`);
    } else {
      setError('');
      setRoomPassword('');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pastel-blue via-pastel-green to-pastel-pink flex flex-col items-center justify-center p-4 selection:bg-primary selection:text-white">
      <div className="bg-white p-8 rounded-xl shadow-soft-lg w-full max-w-md transform transition-all duration-500 hover:scale-105 animate-fadeIn">
        <h1 className="text-4xl font-bold text-center text-primary mb-2">Realtime Connect</h1>
        <p className="text-center text-gray-600 mb-8">Hemen bir odaya katılın veya yeni bir oda oluşturun.</p>
        
        {!isConnected && (
            <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded-md relative mb-6 animate-fadeIn" role="alert">
                <span className="block sm:inline">Sunucuya bağlanılıyor... Lütfen bekleyin.</span>
            </div>
        )}

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md relative mb-6 animate-fadeIn" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="roomName" className="block text-sm font-medium text-gray-700 mb-1">
              Oda Adı
            </label>
            <input
              type="text"
              id="roomName"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm placeholder-gray-400 hover:border-gray-400 transition-shadow duration-300 focus:shadow-glow"
              placeholder="Örn: Proje Toplantısı"
              required
              disabled={!isConnected}
            />
          </div>

          <div>
            <label htmlFor="roomPassword" className="block text-sm font-medium text-gray-700 mb-1">
              Oda Şifresi <span className="text-xs text-gray-500">(isteğe bağlı)</span>
            </label>
            <input
              type="password"
              id="roomPassword"
              value={roomPassword}
              onChange={(e) => setRoomPassword(e.target.value)}
              className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm placeholder-gray-400 hover:border-gray-400 transition-shadow duration-300 focus:shadow-glow"
              placeholder="••••••••"
              disabled={!isConnected}
            />
          </div>

          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
              Kullanıcı Adınız
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm placeholder-gray-400 hover:border-gray-400 transition-shadow duration-300 focus:shadow-glow"
              placeholder="Örn: Ali Veli"
              required
              disabled={!isConnected}
            />
          </div>

          <button
            type="submit"
            className={`w-full btn btn-primary py-3 text-base font-semibold rounded-lg shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-dark transition-all duration-300 transform hover:scale-105 active:scale-95 ${!isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={!isConnected}
          >
            <FiLogIn className="inline mr-2 -ml-1"/>Odaya Katıl / Oluştur
          </button>
        </form>
        
        {isConnected && activeRooms.length > 0 && (
          <div className="mt-10 pt-6 border-t border-gray-200 animate-fadeIn">
            <h2 className="text-xl font-semibold text-gray-700 mb-4 text-center">Aktif Odalar</h2>
            <div className="max-h-60 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200 scrollbar-thumb-rounded-full">
              {activeRooms.map(room => (
                <div 
                  key={room.id} 
                  className="p-4 bg-gray-50 rounded-lg hover:bg-primary-light hover:shadow-md cursor-pointer border border-gray-300 transition-all duration-200 transform hover:scale-[1.02]"
                  onClick={() => handleRoomClick(room)}
                  title={`'${room.name}' odasına katılmak için tıkla`}
                >
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-primary truncate mr-2">{room.name}</h3>
                    <div className="flex items-center text-sm text-gray-500">
                      <FiUsers className="mr-1.5" /> 
                      <span>{room.userCount}/{room.maxUsers}</span>
                      {room.hasPassword && <FiLock className="ml-2.5 text-amber-500" title="Şifreli Oda"/>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {isConnected && activeRooms.length === 0 && (
            <div className="mt-10 pt-6 border-t border-gray-200">
                 <p className="text-sm text-gray-500 text-center py-4">Şu anda aktif oda bulunmuyor. İlk odayı sen oluştur!</p>
            </div>
        )}

      </div>
      <footer className="mt-8 text-center">
        <p className="text-sm text-gray-600">
          &copy; {new Date().getFullYear()} Realtime Connect. Tüm hakları saklıdır.
        </p>
      </footer>
    </div>
  );
}

export default LoginPage; 