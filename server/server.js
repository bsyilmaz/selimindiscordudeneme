const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Socket.IO sunucusunu CORS ayarlarıyla başlat
// Geliştirme sırasında React dev sunucusu localhost:3000 üzerinden erişeceği için
// ve production'da Render'daki frontend domain'inden erişeceği için uygun CORS ayarları önemlidir.
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "https://your-frontend-app-name.onrender.com"], // TODO: Render frontend URL'inizi buraya ekleyin
    methods: ["GET", "POST"],
    credentials: true
  }
});

const PORT = process.env.PORT || 3001;

// Odaları ve kullanıcılarını saklamak için in-memory bir yapı
// rooms = Map<roomId, { password: string, users: Map<socketId, { username: string, muted: boolean, isSharingScreen: boolean }>, cleanupTimeout: NodeJS.Timeout | null }>
const rooms = new Map();
const ROOM_CLEANUP_DELAY = 2 * 60 * 1000; // 2 dakika

const BROADCAST_ACTIVE_ROOMS_INTERVAL = 5000; // Aktif odaları periyodik olarak da yayınlayabiliriz (opsiyonel)
let activeRoomsInterval = null;

function getActiveRoomsData() {
  return Array.from(rooms.entries())
    .filter(([roomId, roomData]) => roomData.users.size > 0)
    .map(([roomId, roomData]) => ({
      id: roomId,
      name: roomId, // Şimdilik oda adı = oda ID
      userCount: roomData.users.size,
      hasPassword: !!roomData.password,
      maxUsers: 10
    }));
}

function broadcastActiveRooms(socketInstance) {
  const activeRoomsData = getActiveRoomsData();
  // console.log('Aktif odalar yayınlanıyor:', activeRoomsData.length);
  socketInstance.emit('active-rooms-update', activeRoomsData);
}

// Render.com için health check endpoint'i
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

io.on('connection', (socket) => {
  console.log(`Kullanıcı bağlandı: ${socket.id}`);

  // Yeni bağlanan kullanıcıya mevcut aktif odaları gönder
  socket.emit('active-rooms-update', getActiveRoomsData());

  socket.on('join-room', ({ roomId, password, username }) => {
    if (!roomId || !username) {
      return socket.emit('join-room-error', 'Oda adı ve kullanıcı adı gereklidir.');
    }

    let room = rooms.get(roomId);

    // Oda mevcut değilse, yeni oda oluştur
    if (!room) {
      console.log(`Yeni oda oluşturuluyor: ${roomId} - Kullanıcı: ${username}`);
      room = {
        password: password, // Şifre boş olabilir
        users: new Map(),
        cleanupTimeout: null,
        // İleride eklenebilir: screenSharer: null // Ekran paylaşan kullanıcının socket.id'si
      };
      rooms.set(roomId, room);
      cancelRoomCleanup(roomId); // Yeni oda oluştuğu için temizleme zamanlayıcısını (varsa) iptal et
    } else {
      // Oda mevcutsa, şifre kontrolü yap (eğer oda şifreliyse ve girilen şifre varsa)
      if (room.password && room.password !== password) {
        console.log(`Hatalı şifre girişi. Oda: ${roomId}, Kullanıcı: ${username}`);
        return socket.emit('join-room-error', 'Oda şifresi yanlış.');
      }
      // Şifresiz bir odaya şifreyle girilmeye çalışılıyorsa veya şifreli odaya şifresiz girilmeye çalışılıyorsa da kontrol edilebilir.
      // Şimdilik basit tutuyoruz: Oda şifreliyse ve girilen şifre eşleşmiyorsa hata ver.
    }

    // Oda kapasitesini kontrol et
    if (room.users.size >= 10) {
      console.log(`Oda dolu: ${roomId} - Kullanıcı: ${username} katılamadı.`);
      return socket.emit('join-room-error', 'Oda dolu (en fazla 10 kişi).');
    }

    // Kullanıcıyı odaya ekle
    room.users.set(socket.id, { 
        username,
        muted: false, // Varsayılan olarak mikrofon açık
        isSharingScreen: false // Varsayılan olarak ekran paylaşımı kapalı
    });
    socket.join(roomId);
    cancelRoomCleanup(roomId); // Odaya yeni kullanıcı katıldığı için temizleme zamanlayıcısını iptal et

    console.log(`Kullanıcı ${username} (${socket.id}) odaya (${roomId}) katıldı.`);

    // Katılan kullanıcıya başarı mesajı ve oda bilgileri gönder
    socket.emit('joined-room', { 
        roomId,
        // Odadaki diğer kullanıcıların listesi (WebRTC için gerekli olabilir)
        // users: Array.from(room.users.values()).map(u => ({ id: Array.from(room.users.keys())[Array.from(room.users.values()).indexOf(u)], username: u.username }))
    }); 

    // Odadaki diğer tüm kullanıcılara yeni kullanıcının katıldığını bildir
    // ve güncel kullanıcı listesini gönder.
    const roomUserDetails = Array.from(room.users.entries()).map(([id, user]) => ({ 
        id,
        username: user.username,
        muted: user.muted,
        isSharingScreen: user.isSharingScreen
    }));

    socket.to(roomId).emit('user-joined', { 
        userId: socket.id,
        username,
        muted: false,
        isSharingScreen: false
        // roomUsers: roomUserDetails // Alternatif olarak tüm liste burada da gönderilebilir
    });
    io.to(roomId).emit('room-users', roomUserDetails);

    if (room.users.has(socket.id)) { // Kullanıcı başarıyla eklendiyse
        broadcastActiveRooms(io); // Tüm soketlere (genel) yayınla
    }

    // TODO: Diğer WebRTC sinyalizasyon olayları buraya eklenecek
  });

  socket.on('toggle-mute', ({ roomId, muted }) => {
    const room = rooms.get(roomId);
    if (room && room.users.has(socket.id)) {
      const user = room.users.get(socket.id);
      user.muted = muted;
      console.log(`Kullanıcı ${user.username} (${socket.id}) odada (${roomId}) mikrofon durumunu değiştirdi: ${muted ? 'Sessiz' : 'Açık'}`);
      // Güncellenmiş kullanıcı bilgisini odadaki herkese gönder
      const roomUserDetails = Array.from(room.users.entries()).map(([id, u]) => ({ 
        id,
        username: u.username,
        muted: u.muted,
        isSharingScreen: u.isSharingScreen
      }));
      io.to(roomId).emit('room-users', roomUserDetails);
      // Alternatif olarak sadece değişen kullanıcıyı da bildirebiliriz:
      // socket.to(roomId).emit('user-updated', { userId: socket.id, muted });
    } else {
      console.warn(`toggle-mute: Oda (${roomId}) veya kullanıcı (${socket.id}) bulunamadı.`);
    }
  });

  socket.on('toggle-screen-share', ({ roomId, isSharing }) => {
    const room = rooms.get(roomId);
    if (room && room.users.has(socket.id)) {
      const user = room.users.get(socket.id);
      
      // Aynı anda sadece bir kişi ekran paylaşabilir kuralı
      if (isSharing) {
        // Odada başka biri zaten paylaşıyorsa, bu isteği reddet veya mevcut paylaşımı durdur
        const currentSharer = Array.from(room.users.values()).find(u => u.isSharingScreen);
        if (currentSharer && currentSharer !== user) {
          // TODO: İstemciye hata mesajı gönderilebilir: "Zaten başka bir kullanıcı ekran paylaşıyor."
          // Şimdilik sadece logluyoruz ve durumu değiştirmiyoruz.
          console.log(`Kullanıcı ${user.username} ekran paylaşmak istedi ama ${currentSharer.username} zaten paylaşıyor.`);
          // İstemci tarafındaki state'i geri almak için bir olay gönderilebilir.
          socket.emit('screen-share-error', { message: 'Başka bir kullanıcı zaten ekran paylaşıyor.' });
          return; // Paylaşımı başlatma
        }
      }
      
      user.isSharingScreen = isSharing;
      console.log(`Kullanıcı ${user.username} (${socket.id}) odada (${roomId}) ekran paylaşım durumunu değiştirdi: ${isSharing ? 'Paylaşıyor' : 'Durdurdu'}`);
      
      const roomUserDetails = Array.from(room.users.entries()).map(([id, u]) => ({ 
        id,
        username: u.username,
        muted: u.muted,
        isSharingScreen: u.isSharingScreen
      }));
      io.to(roomId).emit('room-users', roomUserDetails);
      // Ayrıca, özellikle ekran paylaşımı durumu değiştiğinde farklı bir olay da gönderilebilir.
      // io.to(roomId).emit('screen-share-changed', { userId: socket.id, isSharing });
    } else {
      console.warn(`toggle-screen-share: Oda (${roomId}) veya kullanıcı (${socket.id}) bulunamadı.`);
    }
  });

  socket.on('leave-room', ({ roomId }) => {
    if (socket.rooms.has(roomId)) {
        const room = rooms.get(roomId);
        const user = room?.users.get(socket.id);
        handleLeaveRoom(socket, roomId);
        // handleLeaveRoom içinde oda silinirse veya kullanıcı sayısı değişirse broadcast yapılır.
    }
  });

  socket.on('disconnecting', () => {
    console.log(`Kullanıcı ayrılıyor: ${socket.id}`);
    let roomLeft = false;
    for (const roomId of socket.rooms) {
      if (roomId !== socket.id) {
        handleLeaveRoom(socket, roomId); // Bu zaten broadcastActiveRooms'u tetikleyebilir
        roomLeft = true;
      }
    }
    // Eğer kullanıcı hiçbir odadan ayrılmadıysa ama bağlantı kesiyorsa (örn. giriş sayfasındayken)
    // ve odalarla ilgili bir durum değişikliği yoksa broadcast'e gerek yok.
    // handleLeaveRoom içindeki mantık yeterli olmalı.
  });

  socket.on('disconnect', () => {
    console.log(`Kullanıcı ayrıldı: ${socket.id}`);
  });

  // TODO: Ana sayfada aktif odaları listelemek için bir olay
  // socket.on('get-active-rooms', () => {
  //   const activeRoomsData = Array.from(rooms.entries())
  //     .filter(([roomId, roomData]) => roomData.users.size > 0) // Sadece dolu odaları al
  //     .map(([roomId, roomData]) => ({
  //       id: roomId,
  //       name: roomId, // Şimdilik oda adı = oda ID
  //       userCount: roomData.users.size,
  //       // hasPassword: !!roomData.password // İsteğe bağlı: odanın şifreli olup olmadığını belirt
  //     }));
  //   socket.emit('active-rooms-list', activeRoomsData);
  // });

  // WebRTC Sinyalizasyon Mesajları
  socket.on('webrtc-offer', ({ targetSocketId, offer, roomId }) => {
    console.log(`Kullanıcı ${socket.id} -> ${targetSocketId} için WebRTC offer gönderdi.`);
    // Offer'ı hedef kullanıcıya ilet
    socket.to(targetSocketId).emit('webrtc-offer', { 
        offererSocketId: socket.id, 
        offer 
    });
  });

  socket.on('webrtc-answer', ({ targetSocketId, answer, roomId }) => {
    console.log(`Kullanıcı ${socket.id} -> ${targetSocketId} için WebRTC answer gönderdi.`);
    // Answer'ı hedef kullanıcıya (offer gönderen kişiye) ilet
    socket.to(targetSocketId).emit('webrtc-answer', { 
        answererSocketId: socket.id, 
        answer 
    });
  });

  socket.on('webrtc-ice-candidate', ({ targetSocketId, candidate, roomId }) => {
    // console.log(`Kullanıcı ${socket.id} -> ${targetSocketId} için ICE candidate gönderdi:`, candidate ? candidate.candidate.substring(0, 30) : 'null');
    // ICE candidate'i hedef kullanıcıya ilet
    socket.to(targetSocketId).emit('webrtc-ice-candidate', { 
        senderSocketId: socket.id, 
        candidate 
    });
  });

  // Kullanıcı hazır olduğunda (medya izinleri alındıktan sonra) bu olay gönderilebilir.
  // Bu, yeni katılanlara offer göndermek için bir tetikleyici olabilir.
  socket.on('ready-for-webrtc', ({ roomId }) => {
    console.log(`Kullanıcı ${socket.id} odada (${roomId}) WebRTC için hazır.`);
    // Odadaki diğer kullanıcılara bu kullanıcının hazır olduğunu bildir.
    // Bu sayede mevcut kullanıcılar yeni kullanıcıya offer gönderebilir.
    const room = rooms.get(roomId);
    if (room && room.users.has(socket.id)) {
        socket.to(roomId).emit('user-ready-for-webrtc', { userId: socket.id });
    }
  });

  socket.on('get-active-rooms', () => {
    socket.emit('active-rooms-update', getActiveRoomsData());
  });

  // Periyodik yayınlama (opsiyonel, çok fazla oda/kullanıcı yoksa gereksiz olabilir)
  // if (!activeRoomsInterval) {
  //   activeRoomsInterval = setInterval(() => {
  //     broadcastActiveRooms(io);
  //   }, BROADCAST_ACTIVE_ROOMS_INTERVAL);
  // }
});

// Oda Temizleme Fonksiyonları
function scheduleRoomCleanup(roomId) {
  const room = rooms.get(roomId);
  if (room && room.users.size === 0) {
    console.log(`Oda (${roomId}) boş, ${ROOM_CLEANUP_DELAY / 1000} saniye sonra silinmek üzere zamanlandı.`);
    // Önceki zamanlayıcıyı temizle (varsa)
    if (room.cleanupTimeout) {
      clearTimeout(room.cleanupTimeout);
    }
    room.cleanupTimeout = setTimeout(() => {
      if (rooms.has(roomId) && rooms.get(roomId).users.size === 0) {
        rooms.delete(roomId);
        console.log(`Oda (${roomId}) otomatik olarak silindi.`);
        broadcastActiveRooms(io); // Oda silindikten sonra listeyi güncelle
      }
    }, ROOM_CLEANUP_DELAY);
  }
}

function cancelRoomCleanup(roomId) {
  const room = rooms.get(roomId);
  if (room && room.cleanupTimeout) {
    console.log(`Oda (${roomId}) için silme zamanlayıcısı iptal edildi (yeni kullanıcı katıldı).`);
    clearTimeout(room.cleanupTimeout);
    room.cleanupTimeout = null;
  }
}

// Bu fonksiyon daha sonra oda yönetimi içinde kullanılacak
function handleLeaveRoom(socket, roomId) {
  const room = rooms.get(roomId);
  if (room) {
    const leavingUser = room.users.get(socket.id);
    if (leavingUser) {
      console.log(`Kullanıcı ${leavingUser.username} (${socket.id}) odadan (${roomId}) ayrıldı.`);
      room.users.delete(socket.id);
      socket.leave(roomId);

      const roomUserDetails = Array.from(room.users.entries()).map(([id, user]) => ({ 
        id,
        username: user.username,
        muted: user.muted,
        isSharingScreen: user.isSharingScreen
      }));

      // Diğer kullanıcılara kullanıcının ayrıldığını bildir
      socket.to(roomId).emit('user-left', { userId: socket.id, username: leavingUser.username });
      // Oda kullanıcı listesini güncelle
      io.to(roomId).emit('room-users', roomUserDetails);

      if (room.users.size === 0) {
        scheduleRoomCleanup(roomId);
      }
      broadcastActiveRooms(io); // Kullanıcı ayrıldıktan sonra listeyi güncelle
    }
  }
}

server.listen(PORT, () => {
  console.log(`Sunucu ${PORT} portunda çalışıyor.`);
  console.log(`Geliştirme için frontend'inize genellikle http://localhost:3000 adresinden erişebilirsiniz.`);
});

// Genel hata yönetimi (isteğe bağlı, ancak iyi bir pratik)
process.on('uncaughtException', (error) => {
  console.error('Beklenmeyen bir hata oluştu:', error);
  // Gerekirse burada uygulamayı düzgün bir şekilde kapatabilirsiniz.
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('İşlenmemiş bir promise reddedildi:', promise, 'sebep:', reason);
}); 