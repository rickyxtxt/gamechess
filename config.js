// Isi setelah deploy kontrak (lihat README.md).
export const CONTRACT_ADDRESS = "0x095DAcf1Df71AA5B5a4140a7112486D325742Bf9";

// Default: Ethereum Sepolia. Ganti bila deploy di testnet EVM lain
// (mis. Base Sepolia: chainId 84532, rpc https://sepolia.base.org, explorer https://sepolia.basescan.org).
export const CHAIN = {
  chainId: "8545",
  name: "BNB Smart Chain Testnet",
  rpc: "https://data-seed-prebsc-1-s2.bnbchain.org",
  explorer: "https://testnet.bscscan.com/",
  currency: { name: "BNB Smart Chain Testnet", symbol: "tBNB", decimals: 18 },
};
