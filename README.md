# Catur On-Chain (testnet EVM + Vercel)

Game catur dua pemain. **Setiap langkah adalah transaksi ke smart contract**: papan baru bergerak setelah
transaksi terkonfirmasi di blockchain (`tx.wait()`). Jika transaksi ditolak/gagal, langkah dibatalkan.

## Isi
- `contracts/ChessGame.sol` – smart contract (giliran, format langkah, status game, event)
- `index.html`, `style.css`, `app.js`, `config.js` – frontend statis (ethers v6 + chess.js via CDN, tanpa build)
- `vercel.json` – konfigurasi Vercel statis

## Langkah deploy
1. **Siapkan wallet + saldo testnet.** Default Sepolia; ambil ETH gratis dari faucet (mis. Google Cloud Web3 faucet,
   Alchemy faucet, atau faucet Sepolia lainnya).
2. **Deploy kontrak** lewat https://remix.ethereum.org:
   - Buat file `ChessGame.sol`, tempel isi `contracts/ChessGame.sol`.
   - Compiler 0.8.20+ → Compile.
   - Tab *Deploy*: Environment `Injected Provider` (jaringan Sepolia) → Deploy.
   - Salin alamat kontrak.
3. **Edit `config.js`**: isi `CONTRACT_ADDRESS`. Untuk testnet lain, ubah juga `CHAIN` (chainId, rpc, explorer).
4. **Deploy ke Vercel (gratis, plan Hobby):**
   - Lewat GitHub: push folder ini → vercel.com/new → Import → Framework `Other`, tanpa Build Command → Deploy.
   - Atau CLI: `npm i -g vercel` lalu `vercel --prod` di folder ini.

   **Alternatif Netlify (gratis):** buka https://app.netlify.com/drop lalu seret folder ini, atau import dari GitHub
   dengan Build command kosong dan Publish directory `.` (sudah diatur di `netlify.toml`).

## Cara main
1. Pemain 1: *Hubungkan wallet* → *Buat game baru* (jadi putih). Bagikan ID/tautan (`#game=ID`).
2. Pemain 2: hubungkan wallet → isi ID → *Gabung* (jadi hitam).
3. Klik bidak → klik petak tujuan → setujui transaksi di wallet → tunggu "terkonfirmasi".
   Lawan melihat langkah otomatis (polling 4 detik).
4. Skakmat: pemenang menekan *Klaim kemenangan*. Seri: pemain yang sedang giliran menekan *Laporkan seri*.
   *Menyerah* tersedia kapan saja.

Tes solo: satu wallet boleh membuat dan menggabung game sendiri, lalu memainkan kedua sisi.

## Catatan batasan
- Aturan catur penuh (legalitas langkah, skakmat) divalidasi di klien dengan chess.js; kontrak hanya memaksa
  giliran, format UCI, dan status. Validasi on-chain penuh sangat mahal gas. Pemain curang bisa mengirim langkah
  ilegal lewat kontrak langsung; klien lawan akan berhenti sinkron. Cocok untuk demo/testnet.
- Kode ini belum diuji di lingkungan pembuatnya (tanpa akses jaringan); lakukan uji di testnet sebelum dibagikan.
