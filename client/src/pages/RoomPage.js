import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext';
import { FiMic, FiMicOff, FiVideo, FiVideoOff, FiLogOut, FiUsers, FiShare, FiXCircle } from 'react-icons/fi'; // İkonlar
import AudioVisualizer from '../components/AudioVisualizer'; // Eklendi

// Rastgele renk üretici (kullanıcı etiketleri için)
const colors = [
  'user-tag-red', 'user-tag-blue', 'user-tag-green', 'user-tag-yellow',
  'user-tag-purple', 'user-tag-pink', 'user-tag-indigo', 'user-tag-gray'
];
const getRandomColor = (userId) => {
  // Basit bir hash fonksiyonu ile kullanıcı ID'sine göre renk seçimi
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const STUN_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // Kendi STUN/TURN sunucunuzu da ekleyebilirsiniz.
  ],
};

function RoomPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { socket, isConnected } = useSocket();
  const [users, setUsers] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [showUserList, setShowUserList] = useState(true); // Mobil için kullanıcı listesi görünürlüğü
  const [mediaError, setMediaError] = useState(null);

  // WebRTC için placeholder ref'ler
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null); // Kendi medya akışımızı saklamak için
  const remoteVideosRef = useRef({}); // { socketId: ref }
  const peerConnectionsRef = useRef({}); // { socketId: RTCPeerConnection }
  const screenStreamRef = useRef(null); // Ekran paylaşım akışını saklamak için
  const originalVideoTrackRef = useRef(null); // Orijinal kamera video izini saklamak için
  const remoteAudioStreamsRef = useRef({}); // { socketId: MediaStream }

  // Medya izinlerini iste ve local stream'i başlat
  useEffect(() => {
    const getMediaPermissions = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: {
            // İsteğe bağlı: Arka plan gürültü engelleme özellikleri
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true // Otomatik kazanç kontrolü
          }
        });
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        setMediaError(null);
        // İzinler alındıktan sonra ve socket bağlıysa, sunucuya hazır olduğumuzu bildirebiliriz.
        // Bu, WebRTC bağlantılarını başlatmak için bir işaret olabilir.
        if (socket && isConnected) {
          console.log('Medya hazır, sunucuya ready-for-webrtc gönderiliyor.');
          socket.emit('ready-for-webrtc', { roomId });
        }
      } catch (err) {
        console.error('Medya erişim hatası:', err);
        setMediaError(
          'Kamera ve mikrofon erişimi reddedildi veya bir hata oluştu. ' +
          'Lütfen tarayıcı ayarlarınızı kontrol edin ve sayfayı yenileyin. ' +
          `(${err.name}: ${err.message})`
        );
        // Kullanıcıya bir hata mesajı gösterilebilir
      }
    };

    // Sadece socket bağlantısı kurulduktan sonra ve henüz local stream yoksa izin iste
    if (isConnected && socket && !localStreamRef.current) {
        getMediaPermissions();
    }

    // Cleanup: Bileşen kaldırıldığında medya akışını durdur
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
        // Tüm peer connection'ları kapat
        Object.values(peerConnectionsRef.current).forEach(pc => pc.close());
        peerConnectionsRef.current = {};
        console.log('Yerel medya akışı durduruldu.');
      }
    };
  }, [isConnected, socket, roomId]); // roomId eklendi, çünkü emit içinde kullanılıyor

  useEffect(() => {
    if (!isConnected || !socket || !localStreamRef.current) {
      // localStreamRef hazır olmadan WebRTC işlemleri yapamayız
      return;
    }

    const createPeerConnection = (targetSocketId) => {
      if (peerConnectionsRef.current[targetSocketId]) {
        console.log('Peer connection zaten var:', targetSocketId);
        return peerConnectionsRef.current[targetSocketId];
      }
      console.log('Peer connection oluşturuluyor:', targetSocketId);
      const pc = new RTCPeerConnection(STUN_SERVERS);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('webrtc-ice-candidate', { 
            targetSocketId, 
            candidate: event.candidate, 
            roomId 
          });
        }
      };

      pc.ontrack = (event) => {
        console.log('Remote track alındı:', targetSocketId, event.streams[0]);
        if (remoteVideosRef.current[targetSocketId]) {
          remoteVideosRef.current[targetSocketId].srcObject = event.streams[0];
        }
        // Ses görselleştiricisi için sadece ses izlerini içeren bir stream sakla
        if (event.streams[0]) {
            const audioTracks = event.streams[0].getAudioTracks();
            if (audioTracks.length > 0) {
                // remoteAudioStreamsRef.current[targetSocketId] = new MediaStream([audioTracks[0]]);
                // Veya tüm stream'i saklayıp AudioVisualizer'a sadece audio track'i olan bir stream geçebiliriz.
                // Şimdilik tüm stream'i video ref'e atadığımız için, AudioVisualizer'a direkt event.streams[0] geçebiliriz.
                // AudioVisualizer zaten sadece audio track'i kullanmaya çalışacak.
                // State güncellemesi tetiklemek için users listesini güncellemek gerekebilir ya da
                // remoteAudioStreamsRef'i bir state yapıp onu güncellemek daha reaktif olur.
                // Geçici çözüm: Doğrudan ref'e atama ve umarım yeniden render tetiklenir.
                // Daha iyi çözüm: setUsers ile kullanıcıya stream bilgisini eklemek.
                 setUsers(prevUsers => prevUsers.map(u => u.id === targetSocketId ? { ...u, remoteStream: event.streams[0] } : u));
            } else {
                 // Eğer stream'de ses izi yoksa, null olarak işaretle
                 setUsers(prevUsers => prevUsers.map(u => u.id === targetSocketId ? { ...u, remoteStream: null } : u));
            }
        }
      };

      // Yerel stream'deki track'leri peer connection'a ekle
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });

      peerConnectionsRef.current[targetSocketId] = pc;
      return pc;
    };

    // Bir kullanıcı hazır olduğunda (yeni katılan veya mevcut)
    const handleUserReady = async ({ userId }) => {
      if (userId === socket.id) return; // Kendimiz için işlem yapma
      console.log(`Kullanıcı ${userId} WebRTC için hazır. Offer gönderiliyor.`);
      const pc = createPeerConnection(userId);
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('webrtc-offer', { targetSocketId: userId, offer, roomId });
      } catch (error) {
        console.error('Offer oluşturma/gönderme hatası:', error);
      }
    };
    socket.on('user-ready-for-webrtc', handleUserReady);

    // Offer alındığında
    const handleOffer = async ({ offererSocketId, offer }) => {
      console.log(`Offer alındı: ${offererSocketId}`);
      const pc = createPeerConnection(offererSocketId);
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('webrtc-answer', { targetSocketId: offererSocketId, answer, roomId });
      } catch (error) {
        console.error('Answer oluşturma/gönderme hatası:', error);
      }
    };
    socket.on('webrtc-offer', handleOffer);

    // Answer alındığında
    const handleAnswer = async ({ answererSocketId, answer }) => {
      console.log(`Answer alındı: ${answererSocketId}`);
      const pc = peerConnectionsRef.current[answererSocketId];
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (error) {
          console.error('Remote description (answer) ayarlama hatası:', error);
        }
      } else {
        console.warn('Answer için peer connection bulunamadı:', answererSocketId);
      }
    };
    socket.on('webrtc-answer', handleAnswer);

    // ICE candidate alındığında
    const handleIceCandidate = async ({ senderSocketId, candidate }) => {
      // console.log(`ICE candidate alındı: ${senderSocketId}`, candidate ? candidate.candidate.substring(0,30) : 'null');
      const pc = peerConnectionsRef.current[senderSocketId];
      if (pc && candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
          console.error('ICE candidate ekleme hatası:', error);
        }
      } else if (!pc) {
        console.warn('ICE candidate için peer connection bulunamadı:', senderSocketId);
      }
    };
    socket.on('webrtc-ice-candidate', handleIceCandidate);
    
    // ... (handleRoomUsers, handleUserJoined (içeriği değişebilir), handleUserLeft, handleScreenShareError aynı veya güncellenmiş)
    const handleRoomUsers = (roomUsers) => {
        setUsers(roomUsers.map(u => ({ ...u, remoteStream: users.find(prev_u => prev_u.id === u.id)?.remoteStream || null }) ));
        const self = roomUsers.find(u => u.id === socket.id);
        if (self) {
            setCurrentUser(self);
            if (localStreamRef.current && localStreamRef.current.getAudioTracks().length > 0) {
                localStreamRef.current.getAudioTracks()[0].enabled = !self.muted;
            }
            setIsMuted(self.muted);
            setIsScreenSharing(self.isSharingScreen);
        }
        // Yeni kullanıcılar için peer connection kurma mantığı (eğer 'user-ready-for-webrtc' yetersizse)
        // roomUsers.forEach(user => {
        //   if (user.id !== socket.id && !peerConnectionsRef.current[user.id]) {
        //     // Bu kullanıcı için offer gönder (eğer onlar da hazırsa)
        //     // Bu mantık user-ready-for-webrtc ile daha iyi yönetilebilir.
        //   }
        // });
    };
    socket.on('room-users', handleRoomUsers);

    const handleUserLeft = (data) => {
      console.log('Kullanıcı ayrıldı (ana useEffect):', data.username, data.userId);
      if (peerConnectionsRef.current[data.userId]) {
        peerConnectionsRef.current[data.userId].close();
        delete peerConnectionsRef.current[data.userId];
      }
      if(remoteVideosRef.current[data.userId]) {
        const videoElement = remoteVideosRef.current[data.userId];
        if(videoElement) videoElement.srcObject = null;
        delete remoteVideosRef.current[data.userId];
      }
      // remoteAudioStreamsRef.current[data.userId] = null; // Temizle
      setUsers(prevUsers => prevUsers.map(u => u.id === data.userId ? { ...u, remoteStream: null } : u));
    };
    socket.on('user-left', handleUserLeft);

    // Diğer dinleyiciler (user-joined, screen-share-error)
    // handleUserJoined artık handleUserReady tarafından kapsanıyor gibi

    return () => {
      socket.off('user-ready-for-webrtc', handleUserReady);
      socket.off('webrtc-offer', handleOffer);
      socket.off('webrtc-answer', handleAnswer);
      socket.off('webrtc-ice-candidate', handleIceCandidate);
      socket.off('room-users', handleRoomUsers);
      socket.off('user-left', handleUserLeft);
      // socket.off('screen-share-error', handleScreenShareError); // Bu zaten vardı
    };
  }, [socket, isConnected, isScreenSharing, roomId, users]); // users state'i eklendi (remoteStream için)

  const handleToggleMute = () => {
    if (socket) {
        const newMutedState = !isMuted;
        setIsMuted(newMutedState);
        socket.emit('toggle-mute', { roomId, muted: newMutedState });
        // TODO: WebRTC local audio track enable/disable
        console.log(newMutedState ? 'Mikrofon kapatıldı' : 'Mikrofon açıldı');
        if (localStreamRef.current && localStreamRef.current.getAudioTracks().length > 0) {
            localStreamRef.current.getAudioTracks()[0].enabled = !newMutedState;
        }
    }
  };

  const handleToggleScreenShare = async () => {
    if (!socket) return;

    if (isScreenSharing) { // Ekran paylaşımını durduruyorsak
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
        screenStreamRef.current = null;
      }

      // Orijinal kamera video izini geri yükle
      if (originalVideoTrackRef.current && localStreamRef.current) {
        for (const socketId in peerConnectionsRef.current) {
          const pc = peerConnectionsRef.current[socketId];
          const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
          if (sender) {
            try {
              await sender.replaceTrack(originalVideoTrackRef.current);
            } catch (e) {
              console.error('Kamera izine geri dönerken replaceTrack hatası:', e);
            }
          }
        }
        // Lokal videoyu da orijinal kamera ile güncelle
        if (localVideoRef.current) {
            const newStreamWithCam = new MediaStream([originalVideoTrackRef.current, ...localStreamRef.current.getAudioTracks()]);
            localVideoRef.current.srcObject = newStreamWithCam;
        }
        originalVideoTrackRef.current = null;
      }
      setIsScreenSharing(false);
      socket.emit('toggle-screen-share', { roomId, isSharing: false });
      console.log('Ekran paylaşımı durduruldu.');
    } else { // Ekran paylaşımını başlatıyorsak
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ 
          video: true, 
          audio: true // Kullanıcı ekran sesini de paylaşmak isteyebilir
        });
        screenStreamRef.current = stream;
        const screenVideoTrack = stream.getVideoTracks()[0];
        // const screenAudioTrack = stream.getAudioTracks()[0]; // Eğer ekran sesi de gönderilecekse

        if (localStreamRef.current && localStreamRef.current.getVideoTracks().length > 0) {
            originalVideoTrackRef.current = localStreamRef.current.getVideoTracks()[0];
        }

        for (const socketId in peerConnectionsRef.current) {
          const pc = peerConnectionsRef.current[socketId];
          const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
          if (sender) {
            await sender.replaceTrack(screenVideoTrack);
          } else {
            // Eğer video sender yoksa (sadece sesli bağlantı kurulduysa), yeni track ekle
            // Bu durum daha karmaşık, şimdilik sender olduğunu varsayalım
            // pc.addTrack(screenVideoTrack, stream);
          }
          // Eğer ekran sesi de gönderilecekse audio track için de benzer bir işlem yapılmalı
        }

        // Yerel videoyu ekran paylaşımıyla güncelle
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream; // Sadece ekranı göster, sesi yerel stream'den almaya devam edebiliriz
        }

        // Ekran paylaşımı penceresi kapatıldığında (kullanıcı tarayıcı arayüzünden durdurursa)
        screenVideoTrack.onended = () => {
          console.log('Ekran paylaşımı kullanıcı tarafından sonlandırıldı.');
          if(isScreenSharing) { // Eğer hala state'de aktifse, durdurma işlemini tetikle
            handleToggleScreenShare(); // Bu kendini tekrar çağıracak ve durdurma bloğunu çalıştıracak
          }
        };

        setIsScreenSharing(true);
        socket.emit('toggle-screen-share', { roomId, isSharing: true });
        console.log('Ekran paylaşımı başlatıldı.');

      } catch (err) {
        console.error('Ekran paylaşımı başlatma hatası:', err);
        alert('Ekran paylaşılamadı: ' + err.message);
        // Sunucuya hata durumunda isSharing:false gönderilebilir veya client state'i geri alınır.
        // Sunucu zaten tek paylaşımcı kuralını uyguluyor, o yüzden 'screen-share-error' gelecektir.
      }
    }
  };

  const handleLeaveRoom = () => {
    if (socket) {
      socket.emit('leave-room', { roomId });
      // WebRTC bağlantılarını temizle
      // Ekran paylaşımını durdur (eğer açıksa)
    }
    navigate('/'); // Giriş sayfasına yönlendir
    console.log('Odadan ayrılınıyor...');
  };

  if (!isConnected && !currentUser && !mediaError) { // Henüz socket bağlanmadıysa veya kullanıcı bilgisi yoksa yükleniyor ekranı
    return (
        <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-500"></div>
            <p className="mt-4 text-xl">Odaya bağlanılıyor...</p>
        </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col md:flex-row overflow-hidden">
      {mediaError && (
          <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4 animate-fadeIn">
              <div className="bg-gray-800 p-8 rounded-xl shadow-2xl max-w-md w-full text-center ring-2 ring-red-500">
                  <FiXCircle className="text-red-500 text-5xl mx-auto mb-4" />
                  <h3 className="text-2xl font-bold text-red-400 mb-3">Medya Erişimi Hatası!</h3>
                  <p className="text-gray-300 mb-6 text-sm">{mediaError}</p>
                  <button 
                      onClick={() => window.location.reload()} 
                      className="w-full btn bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-lg font-semibold transition-transform transform hover:scale-105 active:scale-95"
                  >
                      Sayfayı Yenile ve İzinleri Kontrol Et
                  </button>
              </div>
          </div>
      )}
      {/* Yan Panel (Kullanıcı Listesi) */}
      <aside className={`bg-gray-800 p-4 space-y-4 w-full md:w-64 lg:w-72 transition-all duration-300 ease-in-out transform ${showUserList ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:relative fixed inset-y-0 left-0 z-30 md:z-auto shadow-lg md:shadow-none`}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-primary">Oda: {roomId}</h2>
          <button onClick={() => setShowUserList(false)} className="md:hidden p-1 hover:bg-gray-700 rounded">
            <FiXCircle size={20} />
          </button>
        </div>
        <h3 className="text-lg font-medium mb-2 border-b border-gray-700 pb-2">Katılımcılar ({users.length}/10)</h3>
        <ul className="space-y-3 overflow-y-auto max-h-[calc(100vh-200px)] pr-1">
          {users.map((user) => {
            const userSpecificClasses = user.id === socket?.id 
              ? 'bg-primary bg-opacity-30 border-l-4 border-primary' 
              : 'bg-gray-750';
            const statusIndicatorClasses = user.isSharingScreen 
              ? 'bg-green-400 animate-pulse' 
              : (user.muted ? 'bg-red-500' : 'bg-green-500');
            const streamForVisualizer = user.id === socket?.id ? localStreamRef.current : user.remoteStream;
            const visualizerColor = user.id === socket?.id ? '#87CEFA' : '#4A90E2'; // Kendimiz için farklı renk

            return (
              <li 
                key={user.id} 
                className={`flex items-center p-3 rounded-lg shadow-sm transition-all duration-200 hover:bg-gray-700 ${userSpecificClasses}`}
              >
                <div className={`w-3 h-3 rounded-full mr-2 ${statusIndicatorClasses}`}></div>
                <div className="mr-2">
                  {streamForVisualizer && <AudioVisualizer audioStream={streamForVisualizer} width={24} height={24} circleColor={visualizerColor}/>}
                </div>
                <span className={`flex-grow truncate ${getRandomColor(user.id)} px-2 py-1 rounded-md text-sm font-medium`}>
                  {user.username}
                  {user.id === socket?.id ? ' (Siz)' : ''}
                </span>
                {user.isSharingScreen && <FiShare size={16} className="ml-auto text-green-400" title="Ekranını paylaşıyor"/>}
                {user.muted && <FiMicOff size={16} className="ml-auto text-red-400" title="Sessizde"/>}
              </li>
            );
          })}
        </ul>
      </aside>

      {/* Ana İçerik Alanı (Video/Ses Gridi ve Kontroller) */}
      <main className="flex-1 flex flex-col bg-gray-850 p-2 md:p-6">
        {/* Video/Ekran Paylaşım Alanı */}
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6 overflow-y-auto">
          {/* Kendi Video Önizlemesi (Eğer varsa) */}
          {currentUser && (
             <div className="bg-gray-700 rounded-lg shadow-lg overflow-hidden aspect-video flex items-center justify-center relative room-card transform transition-all hover:scale-105">
                <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 px-2 py-1 rounded text-xs flex items-center">
                    {localStreamRef.current && <AudioVisualizer audioStream={localStreamRef.current} width={20} height={20} circleColor='#87CEFA'/>}
                    <span className="ml-1.5">{currentUser.username} (Siz)</span>
                </div>
                {isScreenSharing && <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded-full text-xs animate-pulse">Paylaşılıyor</div>}
             </div>
          )}
          {/* Diğer Kullanıcıların Videoları/Ekran Paylaşımları */}
          {users.filter(u => u.id !== socket?.id).map(user => (
            <div 
              key={user.id} 
              className={`bg-gray-700 rounded-lg shadow-lg overflow-hidden aspect-video flex items-center justify-center relative room-card transform transition-all hover:scale-105 ${user.isSharingScreen ? 'border-4 border-green-500 col-span-full md:col-span-2 lg:col-span-2' : ''}`}
            >
              <video 
                ref={el => { remoteVideosRef.current[user.id] = el; }} 
                autoPlay 
                playsInline 
                className="w-full h-full object-cover" 
              />
              <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 px-2 py-1 rounded text-xs flex items-center">
                {user.remoteStream && <AudioVisualizer audioStream={user.remoteStream} width={20} height={20} />}
                <span className="ml-1.5">{user.username}</span>
              </div>
              {user.isSharingScreen && <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded-full text-xs animate-pulse">Paylaşılıyor</div>}
            </div>
          ))}
        </div>

        {/* Kontrol Butonları */}
        <div className="bg-gray-800 p-4 rounded-xl shadow-2xl flex items-center justify-center space-x-3 md:space-x-6 sticky bottom-0">
          <button 
            onClick={handleToggleMute} 
            className={`btn-icon text-xl p-3 rounded-full transition-all duration-200 ${isMuted ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}
            title={isMuted ? 'Mikrofonu Aç' : 'Sessize Al'}
          >
            {isMuted ? <FiMicOff size={24} /> : <FiMic size={24} />}
          </button>
          <button 
            onClick={handleToggleScreenShare} 
            className={`btn-icon text-xl p-3 rounded-full transition-all duration-200 ${isScreenSharing ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}
            title={isScreenSharing ? 'Paylaşımı Durdur' : 'Ekran Paylaş'}
          >
            {isScreenSharing ? <FiVideoOff size={24} /> : <FiShare size={24} />}{/* FiVideo or FiShare */}
          </button>
          <button 
            onClick={handleLeaveRoom} 
            className="btn-icon bg-red-600 hover:bg-red-700 text-white text-xl p-3 rounded-full transition-all duration-200"
            title="Odadan Ayrıl"
          >
            <FiLogOut size={24} />
          </button>
        </div>
      </main>

      {/* Mobil için Kullanıcı Listesi Butonu */}
      {!showUserList && (
        <button 
            onClick={() => setShowUserList(true)} 
            className="md:hidden fixed bottom-20 right-4 z-40 bg-primary hover:bg-primary-dark text-white p-3 rounded-full shadow-lg animate-fadeIn"
            title="Katılımcıları Göster"
        >
            <FiUsers size={24} />
        </button>
      )}
    </div>
  );
}

export default RoomPage; 