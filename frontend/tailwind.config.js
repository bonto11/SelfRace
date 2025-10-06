/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}", // ak máš src/
    "./app/**/*.{js,ts,jsx,tsx}", // ak používaš app router
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
   theme: {
    extend: {
      colors: {
        background: "var(--background)",
        surface: "var(--surface)",
        border: "var(--border)",
        text: "var(--text)",
        muted: "var(--muted)",
        primary: {
          DEFAULT: "var(--primary)",
          fg: "var(--on-primary)",
        },
        success: "var(--success)",
        danger: "var(--danger)",
        warning: "var(--warning)",
      },
      ringColor: {
        DEFAULT: "var(--ring)",
      },
    },
  },
  plugins: [],
};