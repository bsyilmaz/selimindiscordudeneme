import React, { useEffect, useRef } from 'react';

const AudioVisualizer = ({ audioStream, width = 40, height = 40, circleColor = '#4A90E2' }) => {
  const canvasRef = useRef(null);
  const animationFrameIdRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const dataArrayRef = useRef(null);

  useEffect(() => {
    if (!audioStream || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = width;
    canvas.height = height;

    // Temiz bir başlangıç için önceki context ve analyser'ı temizle (stream değişirse)
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(e => console.warn('AudioContext kapatılırken hata:', e));
    }
    if (sourceRef.current) {
        try {
            sourceRef.current.disconnect();
        } catch(e) { console.warn('Source disconnect hatası', e); }
    }
    if (analyserRef.current) {
        try {
            analyserRef.current.disconnect();
        } catch(e) { console.warn('Analyser disconnect hatası', e); }
    }

    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    analyserRef.current = audioContextRef.current.createAnalyser();
    analyserRef.current.fftSize = 256; // Daha az detay, daha iyi performans
    const bufferLength = analyserRef.current.frequencyBinCount;
    dataArrayRef.current = new Uint8Array(bufferLength);

    try {
        sourceRef.current = audioContextRef.current.createMediaStreamSource(audioStream);
        sourceRef.current.connect(analyserRef.current);
        // Analyser'ı doğrudan destination'a bağlamıyoruz, sesi duymak istemiyoruz (zaten duyuluyor)
    } catch (error) {
        console.error('MediaStreamSource oluşturulamadı:', error, audioStream ? audioStream.getAudioTracks() : 'Stream yok');
        // Eğer stream'de aktif ses track yoksa bu hata olabilir.
        if (audioStream && audioStream.getAudioTracks().length === 0) {
            console.warn('Audio stream\'de aktif ses izi bulunmuyor.');
        } else if (audioStream && audioStream.getAudioTracks().some(track => track.readyState === 'ended')) {
            console.warn('Audio stream\'deki bazı ses izleri sonlanmış.');
        }
        return; // Hata durumunda çizimi başlatma
    }

    const draw = () => {
      if (!analyserRef.current || !ctx || !dataArrayRef.current || audioContextRef.current?.state === 'closed') {
        // animationFrameIdRef.current = requestAnimationFrame(draw); // Context kapalıysa tekrar çağırmayı durdur
        return;
      }

      analyserRef.current.getByteFrequencyData(dataArrayRef.current);
      
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArrayRef.current[i];
      }
      const average = sum / bufferLength;
      const radius = Math.min(width, height) / 4 + (average / 256) * (Math.min(width, height) / 2.5);

      ctx.clearRect(0, 0, width, height);
      
      // Dış daire (sabit veya hafif animasyonlu)
      // ctx.beginPath();
      // ctx.arc(width / 2, height / 2, Math.min(width, height) / 3, 0, 2 * Math.PI);
      // ctx.strokeStyle = 'rgba(74, 144, 226, 0.2)';
      // ctx.lineWidth = 1;
      // ctx.stroke();

      // İçteki ses dalgası dairesi
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, Math.max(2, radius), 0, 2 * Math.PI);
      ctx.fillStyle = circleColor;
      ctx.fill();
      
      animationFrameIdRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameIdRef.current);
      if (sourceRef.current) {
        try { sourceRef.current.disconnect(); } catch(e) {/* ignore */}
      }
      if (analyserRef.current) {
        try { analyserRef.current.disconnect(); } catch(e) {/* ignore */}
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(e => console.warn('AudioContext kapatılırken (cleanup) hata:', e));
      }
      audioContextRef.current = null;
      analyserRef.current = null;
      sourceRef.current = null;
    };
  }, [audioStream, width, height, circleColor]);

  if (!audioStream || audioStream.getAudioTracks().length === 0 || audioStream.getAudioTracks().every(track => track.readyState === 'ended' || !track.enabled)) {
    // Eğer stream yoksa, ses izi yoksa veya tüm ses izleri kapalıysa/sonlanmışsa, görselleştiriciyi gösterme veya pasif bir şey göster
    return <div style={{ width, height, borderRadius: '50%', backgroundColor: 'rgba(128, 128, 128, 0.2)' }} title="Ses yok veya kapalı"></div>;
  }

  return <canvas ref={canvasRef} title="Ses aktivitesi" />;
};

export default AudioVisualizer; 