/*
 PETUNJUK DEPLOY DI REMIX (https://remix.ethereum.org)
 1. Buat file baru "ChessGame.sol" di folder contracts, tempel seluruh isi file ini.
 2. Tab "Solidity compiler": pilih versi 0.8.20 atau lebih baru -> klik "Compile ChessGame.sol".
 3. Tab "Deploy & run transactions":
      - ENVIRONMENT : "Injected Provider - MetaMask" (pastikan wallet di jaringan testnet, mis. Sepolia,
                      dan punya saldo ETH testnet dari faucet)
      - CONTRACT    : ChessGame (tanpa constructor / tanpa argumen)
      - klik "Deploy" lalu setujui transaksi di wallet.
 4. Salin alamat kontrak dari "Deployed Contracts" (ikon copy) ke CONTRACT_ADDRESS di config.js.
 5. (Opsional) Tes cepat di Remix: createGame -> joinGame(1) -> makeMove(1, "e2e4") -> getMoves(1).
*/

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ChessGame - setiap langkah catur dicatat sebagai transaksi on-chain.
/// Kontrak memaksa: giliran pemain, format langkah (UCI, mis. "e2e4", "e7e8q"), dan status game.
/// Validasi aturan catur penuh dilakukan di klien (chess.js) agar gas tetap murah.
contract ChessGame {
    enum Status { Waiting, Active, Finished }

    struct Game {
        address white;
        address black;
        Status status;
        address winner; // address(0) = seri / dibatalkan
        string[] moves;
    }

    uint256 public gameCount;
    mapping(uint256 => Game) private games;

    event GameCreated(uint256 indexed id, address indexed white);
    event GameJoined(uint256 indexed id, address indexed black);
    event MoveMade(uint256 indexed id, address indexed player, string uci, uint256 moveNumber);
    event GameEnded(uint256 indexed id, address indexed winner, string reason);

    function createGame() external returns (uint256 id) {
        id = ++gameCount;
        Game storage g = games[id];
        g.white = msg.sender;
        g.status = Status.Waiting;
        emit GameCreated(id, msg.sender);
    }

    /// Boleh gabung ke game sendiri (berguna untuk tes solo dengan satu wallet).
    function joinGame(uint256 id) external {
        Game storage g = _get(id);
        require(g.status == Status.Waiting, "Game tidak menunggu lawan");
        g.black = msg.sender;
        g.status = Status.Active;
        emit GameJoined(id, msg.sender);
    }

    function makeMove(uint256 id, string calldata uci) external {
        Game storage g = _get(id);
        require(g.status == Status.Active, "Game tidak aktif");
        uint256 n = g.moves.length;
        require(msg.sender == (n % 2 == 0 ? g.white : g.black), "Bukan giliranmu");
        _checkFormat(bytes(uci));
        g.moves.push(uci);
        emit MoveMade(id, msg.sender, uci, n + 1);
    }

    function resign(uint256 id) external {
        Game storage g = _get(id);
        require(g.status != Status.Finished, "Game sudah selesai");
        require(msg.sender == g.white || msg.sender == g.black, "Bukan pemain");
        if (g.status == Status.Waiting) {
            g.status = Status.Finished;
            emit GameEnded(id, address(0), "dibatalkan");
            return;
        }
        g.status = Status.Finished;
        g.winner = msg.sender == g.white ? g.black : g.white;
        emit GameEnded(id, g.winner, "menyerah");
    }

    /// Dipanggil oleh pemain yang baru saja melangkah dan skakmat.
    function reportCheckmate(uint256 id) external {
        Game storage g = _get(id);
        require(g.status == Status.Active && g.moves.length > 0, "Game tidak aktif");
        address lastMover = g.moves.length % 2 == 1 ? g.white : g.black;
        require(msg.sender == lastMover, "Hanya pemain yang melangkah terakhir");
        g.status = Status.Finished;
        g.winner = msg.sender;
        emit GameEnded(id, msg.sender, "skakmat");
    }

    /// Dipanggil oleh pemain yang sedang mendapat giliran saat posisi seri (stalemate dsb).
    function reportDraw(uint256 id) external {
        Game storage g = _get(id);
        require(g.status == Status.Active, "Game tidak aktif");
        address toMove = g.moves.length % 2 == 0 ? g.white : g.black;
        require(msg.sender == toMove, "Hanya pemain yang sedang giliran");
        g.status = Status.Finished;
        emit GameEnded(id, address(0), "seri");
    }

    function getGame(uint256 id)
        external
        view
        returns (address white, address black, uint8 status, uint16 moveCount, address winner)
    {
        Game storage g = _get(id);
        return (g.white, g.black, uint8(g.status), uint16(g.moves.length), g.winner);
    }

    function getMoves(uint256 id) external view returns (string[] memory) {
        return _get(id).moves;
    }

    function _get(uint256 id) private view returns (Game storage) {
        require(id > 0 && id <= gameCount, "Game tidak ada");
        return games[id];
    }

    function _checkFormat(bytes memory m) private pure {
        require(m.length == 4 || m.length == 5, "Format langkah salah");
        require(_file(m[0]) && _file(m[2]) && _rank(m[1]) && _rank(m[3]), "Petak tidak valid");
        require(!(m[0] == m[2] && m[1] == m[3]), "Langkah kosong");
        if (m.length == 5) {
            bytes1 p = m[4];
            require(p == "q" || p == "r" || p == "b" || p == "n", "Promosi tidak valid");
        }
    }

    function _file(bytes1 c) private pure returns (bool) { return c >= "a" && c <= "h"; }
    function _rank(bytes1 c) private pure returns (bool) { return c >= "1" && c <= "8"; }
}
