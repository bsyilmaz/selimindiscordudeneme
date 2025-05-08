/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}", // JavaScript ve TypeScript dosyalarını tara
    "./public/index.html", // Ana HTML dosyasını da tara (nadiren class eklense de)
  ],
  theme: {
    extend: {
      colors: {
        // Projeye özel pastel tonlar veya markaya özel renkler buraya eklenebilir
        primary: {
          light: '#67e8f9', // cyan-300
          DEFAULT: '#06b6d4', // cyan-500
          dark: '#0e7490',  // cyan-700
        },
        secondary: {
          light: '#fecaca', // red-200
          DEFAULT: '#f87171', // red-400
          dark: '#b91c1c'   // red-700
        },
        // Daha fazla pastel ton örneği
        pastel: {
          blue: '#a7c7e7',
          green: '#c1e1c1',
          pink: '#fddde6',
          yellow: '#fffacd',
          purple: '#d7bde2',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'], // Ana yazı tipi olarak Inter
        // 'logo': ['Lobster', 'cursive'], // Örnek logo yazı tipi
      },
      boxShadow: {
        'soft-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.03)',
        'glow': [
          "0 0px 15px rgba(59, 130, 246, 0.5)", // blue-500
          "0 0px 25px rgba(59, 130, 246, 0.3)"
        ]
      },
      keyframes: {
        wave: {
          '0%, 100%': { transform: 'scaleY(0.5)' },
          '50%': { transform: 'scaleY(1.5)' },
        },
        fadeIn: {
            '0%': { opacity: '0' },
            '100%': { opacity: '1' },
        },
        slideInUp: {
            '0%': { transform: 'translateY(20px)', opacity: '0' },
            '100%': { transform: 'translateY(0)', opacity: '1' },
        }
      },
      animation: {
        wave: 'wave 1s linear infinite',
        fadeIn: 'fadeIn 0.5s ease-out',
        slideInUp: 'slideInUp 0.5s ease-out',
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'), // Form stilleri için eklenti
    // Diğer Tailwind eklentileri buraya eklenebilir
  ],
}; 