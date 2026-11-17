# Transcripts - Nasi Goreng Rush

## Project
Game Nasi Goreng Rush, game tangkap bahan masakan (nasi, telur, kecap), hindari cabai, skor + 3 nyawa. Bisa dimainkan mouse / keyboard / HP.

## How I built it
1. Saya buat ide game dan prompt di VS Code.
2. Saya pakai Muse / Copilot di VS Code untuk generate game awal di index.html.
3. Saya minta Copilot untuk pindahkan semua logic game dari index.html ke main.ts dengan TypeScript, dan setup Vite (package.json, tsconfig.json, vite.config.ts) supaya index.html me-load main.ts.
4. Saya upload semua file ke GitHub lewat Upload files.
5. Saya tambahkan LICENSE MIT.

## Tools used
- VS Code
- Muse / Copilot (AI coding assistant)
- GitHub
- GitHub Pages untuk deploy

## Prompts used
- "Tolong buatkan file main.ts di root project ini. Pindahkan semua logic game dari index.html ke dalam main.ts dengan syntax TypeScript yang valid, dan ubah index.html supaya me-load main.ts sebagai entry point. Game harus tetap sama: tangkap nasi/telur/kecap, hindari cabai, skor + 3 nyawa, bisa dimainin mouse/keyboard/HP."

## Result
Game jalan, main.ts ada di root, LICENSE MIT sudah ada.
