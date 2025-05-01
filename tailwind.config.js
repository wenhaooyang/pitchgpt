  /** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      keyframes: {
        blink: {
          "0%, 100%": { opacity: 0 },
          "50%": { opacity: 1 },
        },
      },
      animation: {
        blink: "blink 1s infinite",
      },
      colors: {
        background: '#f8f9fa',
        userBubble: '#d1e7dd',
        aiBubble: '#fff3cd',
        textPrimary: '#212529',
      },
    },
  },
  plugins: [],
}
