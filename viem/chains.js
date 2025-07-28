
import { defineChain } from 'viem';

export const morphHolesky = defineChain({
  id: 2810,
  name: 'Morph Holesky',
  network: 'morph-holesky',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: ['https://rpc-quicknode-holesky.morphl2.io'],
    },
    public: {
      http: ['https://rpc-quicknode-holesky.morphl2.io'],
    },
  },
  blockExplorers: {
    default: { name: 'Morph Holesky Explorer', url: 'https://explorer-holesky.morphl2.io' },
  },
  testnet: true,
});