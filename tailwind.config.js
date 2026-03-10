/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            backgroundImage: {
                'parchment-gradient': 'linear-gradient(to bottom, #2d3436 0%, #000000 100%)',
            },
        },
    },
    plugins: [],
}
