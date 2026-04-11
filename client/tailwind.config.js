/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'brutal-yellow': '#FFD000',
        'brutal-pink': '#FF8AAB',
        'brutal-blue': '#4EC5F1',
        'brutal-green': '#32E0C4',
        'brutal-red': '#FF3B3B',
        'brutal-orange': '#FF8C42',
        'brutal-purple': '#A663CC',
        'brutal-bg': '#FDFBF7',
        'brutal-black': '#1A1A1A',
        'brutal-gray': '#E0E0E0',
      },
      fontFamily: {
        sans: ['Space Grotesk', 'Inter', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'Outfit', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'brutal': '4px 4px 0px 0px rgba(26,26,26,1)',
        'brutal-lg': '8px 8px 0px 0px rgba(26,26,26,1)',
        'brutal-hover': '1px 1px 0px 0px rgba(26,26,26,1)',
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite',
        'marquee': 'marquee 20s linear infinite',
        'pop-in': 'popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
        'bounce-slight': 'bounceSlight 2s ease-in-out infinite',
        'wiggle': 'wiggle 1s ease-in-out infinite',
      },
      keyframes: {
        popIn: {
          '0%': { transform: 'scale(0.8) translateY(20px)', opacity: '0' },
          '100%': { transform: 'scale(1) translateY(0)', opacity: '1' },
        },
        bounceSlight: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-100%)' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        }
      },
    },
  },
  plugins: [],
}
