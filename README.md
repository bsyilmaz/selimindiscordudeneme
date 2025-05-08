# Proje Adı: Real-Time Communication App (Discord/Teams Klonu)

Bu proje, Discord, Microsoft Teams ve Skype benzeri özelliklere sahip, gerçek zamanlı sesli ve görüntülü iletişim sowie ekran paylaşımı sunan bir web uygulamasıdır.

## Özellikler

- **Giriş Ekranı:**
  - Kayıt gerektirmez.
  - Oda adı, oda şifresi ve kullanıcı adı ile giriş.
  - Ana sayfada aktif odaların listelenmesi (isim, kullanıcı sayısı, şifre durumu) ve tıklayarak kolay katılım.
  - Oda yoksa hata mesajı.
- **Oda Sistemi:**
  - Anlık oda oluşturma ve katılma.
  - Maksimum 10 kullanıcı/oda.
  - Sesli konuşma (WebRTC).
  - Ekran paylaşımı (WebRTC - ekran görüntüsü ve sesi, aynı anda sadece bir kişi).
  - Kullanıcılar odadan çıkınca belirli bir süre sonra (2 dakika) otomatik oda silme.
- **Ekran Paylaşımı:**
  - Tarayıcı üzerinden ekran veya uygulama penceresi seçimi.
  - Görüntü ve (destekleniyorsa) sistem sesinin diğer kullanıcılara iletimi.
  - Aktif paylaşım yapan kullanıcıyı vurgulama.
- **Sesli İletişim:**
  - WebRTC üzerinden anlık sesli iletişim.
  - Mikrofon izinleri ve sessize alma (mute) seçeneği.
  - Her kullanıcının ses seviyesi için kullanıcı listesinde ve video üzerinde görsel animasyon.
  - Temel arka plan gürültü filtresi ve yankı engelleme (tarayıcı destekliyorsa).
- **Kullanıcı Arayüzü:**
  - Sade, modern ve mobil uyumlu giriş ekranı (TailwindCSS ile).
  - Koyu temalı, modern ve mobil uyumlu oda içi arayüz:
    - Kullanıcı listesi (yan panel, mobilde açılır/kapanır).
    - Ana video/ses alanı (grid düzenli, ekran paylaşımı öncelikli).
    - Kontrol butonları (Mikrofon Aç/Kapat, Ekran Paylaş/Durdur, Odadan Çık).
  - TailwindCSS ile modern tasarım: yuvarlak köşeli kartlar, pastel arka planlar (giriş), koyu tema (oda), hover efektleri.
- **Teknolojiler:**
  - **Frontend:** React, TailwindCSS, React Router, Socket.IO Client, WebRTC, React Icons
  - **Backend:** Node.js, Express.js, Socket.IO, WebRTC Sinyalizasyonu
  - **Deployment:** Render.com
  - **Veri Saklama:** Sunucuda in-memory (geçici).
- **Ekstralar:**
  - Her kullanıcıya özel rastgele renkli kullanıcı etiketi.
  - Hatalar için sade popup / modal benzeri bildirimler.
  - Odaya girildiğinde kamera/mikrofon izni isteme.

## Kurulum ve Çalıştırma

### Ön Gereksinimler

- Node.js (v18.x veya üzeri önerilir)
- npm veya yarn

### Yerelde Çalıştırma

1.  **Depoyu Klonlayın:**
    ```bash
    git clone <depo_url>
    cd <proje_dizini>
    ```

2.  **Backend Kurulumu ve Başlatma:**
    ```bash
    cd server
    npm install
    npm start # veya geliştirme için npm run dev
    ```
    Sunucu varsayılan olarak `http://localhost:3001` üzerinde çalışacaktır.

3.  **Frontend Kurulumu ve Başlatma:**
    Yeni bir terminal açın:
    ```bash
    cd client
    npm install
    npm start
    ```
    React geliştirme sunucusu varsayılan olarak `http://localhost:3000` üzerinde başlayacaktır. Tarayıcınızda bu adresi açın.

## Dosya Yapısı

- **`/client`**: Frontend React uygulaması.
  - **`/public`**: Statik dosyalar (örn: `index.html`).
  - **`/src`**: React bileşenleri, stiller ve ana uygulama mantığı.
    - **`/components`**: Tekrar kullanılabilir UI bileşenleri.
    - `App.js`: Ana React bileşeni.
    - `index.js`: Uygulamanın giriş noktası.
    - `tailwind.css` (veya `index.css`): TailwindCSS direktifleri ve özel stiller.
  - `package.json`: Frontend bağımlılıkları ve script'leri.
  - `tailwind.config.js`: TailwindCSS yapılandırması.
  - `postcss.config.js`: PostCSS yapılandırması (TailwindCSS için).
- **`/server`**: Backend Node.js/Express.js uygulaması.
  - `server.js`: Ana sunucu dosyası (Express, Socket.IO, WebRTC sinyalizasyon mantığı).
  - `package.json`: Backend bağımlılıkları ve script'leri.
- **`.gitignore`**: Git tarafından izlenmeyecek dosyalar.
- **`README.md`**: Bu dosya.
- **`render.yaml`**: Render.com için dağıtım yapılandırması.

## Deployment (Render.com)

Bu uygulama Render.com üzerinde "Blueprint Instance" olarak (veya ayrı ayrı Web Service ve Static Site olarak) deploy edilebilir. `render.yaml` dosyası, gerekli servislerin ve build komutlarının tanımlanmasını sağlar.

1.  Render.com'da yeni bir "Blueprint Instance" oluşturun.
2.  GitHub deponuzu bağlayın.
3.  `render.yaml` dosyasının kök dizinde olduğundan emin olun. Render, bu dosyayı otomatik olarak algılayacak ve servisleri yapılandıracaktır.
4.  **ÖNEMLİ Ortam Değişkenleri:**
    *   **Backend Servisi İçin (Render Web Service):**
        *   Herhangi bir özel ortam değişkeni gerekmiyorsa boş bırakılabilir. `PORT` genellikle Render tarafından otomatik sağlanır.
    *   **Frontend Servisi İçin (Render Static Site - Build sırasında):**
        *   `REACT_APP_BACKEND_URL`: Backend servisinizin Render üzerindeki URL'si. Örneğin: `https://your-backend-app-name.onrender.com`
        Bu değişken, `client/src/contexts/SocketContext.js` dosyasında backend ile bağlantı kurmak için kullanılır.
5.  **Backend CORS Ayarı:**
    *   Deploy ettikten sonra, backend kodunuzdaki (`server/server.js`) CORS ayarını güncellemeniz **GEREKEBİLİR**.
    *   `io` oluşturulurken `cors.origin` dizisine frontend uygulamanızın Render URL'sini ekleyin:
        ```javascript
        const io = new Server(server, {
          cors: {
            origin: ["http://localhost:3000", "https://your-frontend-app-name.onrender.com"], // <--- BURAYI GÜNCELLEYİN
            methods: ["GET", "POST"],
            credentials: true
          }
        });
        ```
    *   `your-frontend-app-name.onrender.com` kısmını kendi uygulamanızın adıyla değiştirin.
6.  Deploy işlemini başlatın.

Render, frontend için static bir site ve backend için bir Node.js servisi oluşturacaktır.

## Bilinen Kısıtlamalar ve Olası İyileştirmeler

-   **TURN Sunucuları:** Daha güvenilir WebRTC bağlantıları için (özellikle karmaşık ağ yapılandırmalarında) STUN sunucularına ek olarak TURN sunucuları da gerekebilir. Bu projede sadece genel STUN sunucuları kullanılmıştır.
-   **Ölçeklenebilirlik:** Sunucu tarafında odalar ve kullanıcılar in-memory olarak saklandığı için büyük ölçekli kullanımlar için uygun değildir. Daha ölçeklenebilir bir çözüm için Redis gibi harici bir veri deposu kullanılabilir.
-   **Gelişmiş Hata Yönetimi:** Kullanıcı arayüzünde hatalar daha sofistike bir şekilde gösterilebilir.
-   **Mobil Deneyim:** Arayüz mobil uyumlu olsa da, özellikle WebRTC ve medya izinleri konusunda tarayıcıların mobil sürümlerinde farklı davranışlar görülebilir.

## Katkıda Bulunma

Katkıda bulunmak isterseniz, lütfen bir issue açın veya bir pull request gönderin. 