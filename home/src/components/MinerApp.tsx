import { useMemo, useState } from 'react';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { sepolia } from 'wagmi/chains';

import { Header } from './Header';
import { MinerPanel } from './MinerPanel';
import { GoldPanel } from './GoldPanel';

import '../styles/MinerApp.css';

type Tab = 'miner' | 'gold';

export function MinerApp() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  const isWrongNetwork = isConnected && chainId !== sepolia.id;
  const [activeTab, setActiveTab] = useState<Tab>('miner');

  const networkBanner = useMemo(() => {
    if (!isWrongNetwork) return null;
    return (
      <div className="banner banner-warning">
        <div className="banner-title">Wrong network</div>
        <div className="banner-row">
          <div className="banner-text">Switch to Sepolia to use this app.</div>
          <button
            className="button button-secondary"
            onClick={() => switchChain({ chainId: sepolia.id })}
            disabled={!switchChain || isSwitching}
          >
            {isSwitching ? 'Switching...' : 'Switch to Sepolia'}
          </button>
        </div>
      </div>
    );
  }, [isSwitching, isWrongNetwork, switchChain]);

  return (
    <div className="app-shell">
      <Header />
      <main className="container">
        {networkBanner}

        <div className="tabs">
          <button
            className={`tab ${activeTab === 'miner' ? 'active' : ''}`}
            onClick={() => setActiveTab('miner')}
          >
            Miner
          </button>
          <button
            className={`tab ${activeTab === 'gold' ? 'active' : ''}`}
            onClick={() => setActiveTab('gold')}
          >
            Gold
          </button>
        </div>

        {activeTab === 'miner' ? <MinerPanel /> : <GoldPanel />}
      </main>
    </div>
  );
}

