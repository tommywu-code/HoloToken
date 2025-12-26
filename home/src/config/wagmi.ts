import { http, createConfig, createStorage, cookieStorage } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { sepolia } from 'wagmi/chains';

const SEPOLIA_RPC_URL = 'https://ethereum-sepolia.publicnode.com';

export const config = createConfig({
  chains: [sepolia],
  connectors: [injected()],
  transports: {
    [sepolia.id]: http(SEPOLIA_RPC_URL),
  },
  storage: createStorage({ storage: cookieStorage }),
  ssr: false,
});
