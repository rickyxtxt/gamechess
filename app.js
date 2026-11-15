import { BrowserProvider, Contract } from "https://esm.sh/ethers@6.13.4";
import { Chess } from "https://esm.sh/chess.js@1.0.0-beta.8";
import { CONTRACT_ADDRESS, CHAIN } from "./config.js";

const ABI = [
  "function createGame() returns (uint256)",
  "function joinGame(uint256 id)",
  "function makeMove(uint256 id, string uci)",
  "function resign(uint256 id)",
  "function reportCheckmate(uint256 id)",
  "function reportDraw(uint256 id)",
  "function getGame(uint256 id) view returns (address white,address black,uint8 status,uint16 moveCount,address winner)",
  "function getMoves(uint256 id) view returns (string[])",
  "event GameCreated(uint256 indexed id, address indexed white)",
];
const GLYPH = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };
const $ = (s) => document.querySelector(s);
const S = { account: null, c: null, id: null, game: null, chess: new Chess(), sel: null, legal: [], last: null, busy: false };
const short = (a) => a.slice(0, 6) + "…" + a.slice(-4);
const same = (a, b) => a && b && a.toLowerCase() === b.toLowerCase();

function setStatus(t, cls = "") { const el = $("#status"); el.textContent = t; el.className = "status " + cls; }
function setNet(t, cls = "") { const el = $("#net"); el.textContent = t; el.className = "pill " + cls; }
function errText(e) {
  if (e?.code === "ACTION_REJECTED" || e?.code === 4001) return "Transaksi ditolak di wallet. Langkah tidak dicatat.";
  return e?.reason || e?.shortMessage || e?.info?.error?.message || e?.message || "Terjadi kesalahan.";
}

/* ---------- Wallet ---------- */
async function connect() {
  if (!window.ethereum) return setStatus("Wallet tidak ditemukan. Pasang MetaMask atau wallet EVM lain.", "err");
  if (/^0x0{40}$/i.test(CONTRACT_ADDRESS)) return setStatus("Alamat kontrak belum diisi di config.js.", "err");
  try {
    await window.ethereum.request({ method: "eth_requestAccounts" });
    await ensureChain();
    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    S.account = (await signer.getAddress()).toLowerCase();
    S.c = new Contract(CONTRACT_ADDRESS, ABI, signer);
    setNet(`${CHAIN.name} · ${short(S.account)}`, "ok");
    $("#connect").textContent = "Terhubung";
    const m = location.hash.match(/game=(\d+)/);
    if (m) { $("#gid").value = m[1]; await loadGame(Number(m[1])); } else setStatus("Buat game baru atau masukkan ID game.");
    updateButtons();
  } catch (e) { setStatus(errText(e), "err"); }
}
async function ensureChain() {
  const hex = "0x" + CHAIN.chainId.toString(16);
  try {
    await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] });
  } catch (e) {
    if (e.code !== 4902) throw e;
    await window.ethereum.request({ method: "wallet_addEthereumChain", params: [{
      chainId: hex, chainName: CHAIN.name, rpcUrls: [CHAIN.rpc],
      blockExplorerUrls: [CHAIN.explorer], nativeCurrency: CHAIN.currency }] });
  }
}

/* ---------- Transaksi (semua aksi lewat sini, selalu menunggu konfirmasi blok) ---------- */
function logTx(label, hash) {
  const li = document.createElement("li");
  li.className = "s-pending";
  li.innerHTML = `${label} — menunggu konfirmasi · <a href="${CHAIN.explorer}/tx/${hash}" target="_blank" rel="noopener">${short(hash)}</a>`;
  $("#log").prepend(li);
  return (ok, text) => { li.className = ok ? "s-ok" : "s-fail"; li.firstChild.textContent = `${label} — ${text} · `; };
}
async function send(label, fn) {
  if (S.busy) return null;
  S.busy = true; updateButtons();
  try {
    setStatus(`${label}: konfirmasi di wallet…`, "busy");
    const tx = await fn();
    const mark = logTx(label, tx.hash);
    setStatus(`${label}: menunggu konfirmasi blockchain…`, "busy");
    const rc = await tx.wait();
    if (!rc || rc.status !== 1) { mark(false, "gagal"); throw new Error("Transaksi gagal di blockchain."); }
    mark(true, "terkonfirmasi");
    return rc;
  } catch (e) {
    setStatus(errText(e), "err");
    return null;
  } finally { S.busy = false; updateButtons(); }
}

/* ---------- State game ---------- */
async function loadGame(id) {
  S.id = id; S.chess = new Chess(); S.sel = null; S.legal = []; S.last = null; S.game = null;
  try { await sync(true); location.hash = "game=" + id; }
  catch (e) { S.id = null; setStatus("Game #" + id + " tidak ditemukan.", "err"); render(); }
}
async function sync(force = false) {
  if (S.id == null) return;
  const g = await S.c.getGame(S.id);
  S.game = { white: g.white.toLowerCase(), black: g.black.toLowerCase(), status: Number(g.status), moveCount: Number(g.moveCount), winner: g.winner.toLowerCase() };
  if (force || S.game.moveCount !== S.chess.history().length) {
    const moves = await S.c.getMoves(S.id);
    S.chess = new Chess(); S.last = null;
    for (const u of moves) {
      const m = S.chess.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
      S.last = { from: m.from, to: m.to };
    }
    S.sel = null; S.legal = [];
  }
  render();
}
function myTurn() {
  if (!S.game || S.game.status !== 1) return false;
  const who = S.chess.turn() === "w" ? S.game.white : S.game.black;
  return same(who, S.account);
}

/* ---------- Papan ---------- */
function render() {
  const g = S.game;
  const flip = g && same(g.black, S.account) && !same(g.white, S.account);
  let rows = S.chess.board();
  if (flip) rows = [...rows].reverse().map((r) => [...r].reverse());
  const tgt = new Set(S.legal.map((m) => m.to));
  $("#board").innerHTML = rows.flat().map((p, i) => {
    const f = flip ? 7 - (i % 8) : i % 8, r = flip ? 1 + Math.floor(i / 8) : 8 - Math.floor(i / 8);
    const sq = "abcdefgh"[f] + r;
    const cls = ["sq", (f + r) % 2 === 1 ? "d" : "", sq === S.sel ? "sel" : "", tgt.has(sq) ? "tgt" : "",
      S.last && (S.last.from === sq || S.last.to === sq) ? "last" : ""].join(" ");
    const name = p ? `${p.color === "w" ? "putih" : "hitam"} ${p.type}` : "kosong";
    return `<button class="${cls}" data-sq="${sq}" aria-label="${sq} ${name}">${p ? `<span class="pc ${p.color}">${GLYPH[p.type]}\uFE0E</span>` : ""}</button>`;
  }).join("");
  renderInfo();
  if (!S.busy) setStatus(baseStatus());
  updateButtons();
}
function baseStatus() {
  const g = S.game;
  if (!g) return "Buat game baru atau masukkan ID game.";
  if (g.status === 0) return `Game #${S.id} menunggu lawan. Bagikan ID atau tautan halaman ini.`;
  if (g.status === 2) return g.winner === "0x0000000000000000000000000000000000000000" ? "Game selesai: seri atau dibatalkan." : `Game selesai. Pemenang: ${same(g.winner, g.white) ? "putih" : "hitam"} (${short(g.winner)}).`;
  const side = S.chess.turn() === "w" ? "putih" : "hitam";
  if (S.chess.isCheckmate()) return `Skakmat. ${side === "putih" ? "Hitam" : "Putih"} menang; menunggu klaim di blockchain.`;
  if (S.chess.isDraw()) return "Posisi seri; menunggu pemain yang sedang giliran melaporkan.";
  return `Giliran ${side}${S.chess.inCheck() ? " (skak)" : ""} — ${myTurn() ? "giliranmu" : "menunggu lawan"}.`;
}
function renderInfo() {
  const g = S.game;
  $("#info").innerHTML = !g ? "Belum ada game dibuka." : `<dl>
    <dt>Game</dt><dd>#${S.id}</dd>
    <dt>Putih</dt><dd>${short(g.white)}${same(g.white, S.account) ? " (kamu)" : ""}</dd>
    <dt>Hitam</dt><dd>${g.status === 0 ? "—" : short(g.black) + (same(g.black, S.account) ? " (kamu)" : "")}</dd>
    <dt>Langkah</dt><dd>${g.moveCount} terkonfirmasi</dd></dl>`;
}
function updateButtons() {
  const g = S.game, joined = !!S.account, b = S.busy;
  $("#create").disabled = !joined || b;
  $("#join").disabled = !joined || b;
  $("#open").disabled = !joined || b;
  const a = [];
  if (g && g.status === 1 && !b) {
    const lastMover = S.chess.turn() === "w" ? g.black : g.white;
    if (S.chess.isCheckmate() && same(lastMover, S.account)) a.push(["Klaim kemenangan", "claim"]);
    else if (S.chess.isDraw() && myTurn()) a.push(["Laporkan seri", "draw"]);
  }
  if (g && g.status !== 2 && (same(g.white, S.account) || same(g.black, S.account)) && !b) a.push([g.status === 0 ? "Batalkan game" : "Menyerah", "resign", "danger"]);
  $("#actions").innerHTML = a.map(([t, id, c = ""]) => `<button data-act="${id}" class="${c}">${t}</button>`).join("");
}

/* ---------- Aksi ---------- */
$("#board").addEventListener("click", async (e) => {
  const el = e.target.closest(".sq"); if (!el || S.busy || !myTurn()) return;
  const sq = el.dataset.sq;
  const cands = S.legal.filter((m) => m.to === sq);
  if (S.sel && cands.length) {
    const m = cands.find((x) => !x.promotion || x.promotion === $("#promo").value);
    const uci = m.from + m.to + (m.promotion || "");
    const rc = await send(`Langkah ${m.san}`, () => S.c.makeMove(S.id, uci));
    if (rc) { S.sel = null; S.legal = []; await sync(); }
    return;
  }
  const p = S.chess.get(sq);
  if (p && p.color === S.chess.turn()) { S.sel = sq; S.legal = S.chess.moves({ square: sq, verbose: true }); }
  else { S.sel = null; S.legal = []; }
  render();
});
$("#connect").onclick = connect;
$("#create").onclick = async () => {
  const rc = await send("Buat game", () => S.c.createGame());
  if (!rc) return;
  for (const l of rc.logs) {
    try { const p = S.c.interface.parseLog(l); if (p?.name === "GameCreated") { $("#gid").value = p.args.id; return loadGame(Number(p.args.id)); } } catch {}
  }
};
$("#join").onclick = async () => {
  const id = Number($("#gid").value); if (!id) return setStatus("Masukkan ID game.", "err");
  if (await send(`Gabung game #${id}`, () => S.c.joinGame(id))) loadGame(id);
};
$("#open").onclick = () => { const id = Number($("#gid").value); if (id) loadGame(id); };
$("#actions").addEventListener("click", async (e) => {
  const act = e.target.dataset.act; if (!act) return;
  const fn = { claim: ["Klaim skakmat", "reportCheckmate"], draw: ["Laporkan seri", "reportDraw"], resign: ["Menyerah", "resign"] }[act];
  if (await send(fn[0], () => S.c[fn[1]](S.id))) await sync();
});
setInterval(() => { if (S.id != null && !S.busy) sync().catch(() => {}); }, 4000);
if (window.ethereum) {
  window.ethereum.on?.("chainChanged", () => location.reload());
  window.ethereum.on?.("accountsChanged", () => location.reload());
}
render();
