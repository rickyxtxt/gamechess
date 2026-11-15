// Isi setelah deploy kontrak (lihat README.md).
export const CONTRACT_ADDRESS = "0x0000000000000000000000000000000000000000";

// Default: Ethereum Sepolia. Ganti bila deploy di testnet EVM lain
// (mis. Base Sepolia: chainId 84532, rpc https://sepolia.base.org, explorer https://sepolia.basescan.org).
export const CHAIN = {
  chainId: 11155111,
  name: "Sepolia",
  rpc: "https://rpc.sepolia.org",
  explorer: "https://sepolia.etherscan.io",
  currency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
};
