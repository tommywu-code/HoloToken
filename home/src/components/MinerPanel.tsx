import { useCallback, useEffect, useMemo, useState } from 'react';
import { Contract } from 'ethers';
import { useAccount, useReadContract } from 'wagmi';

import { useEthersSigner } from '../hooks/useEthersSigner';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { CHAIN_ID, MINER_NFT_ABI, MINER_NFT_ADDRESS } from '../config/contracts';

import '../styles/Panel.css';

function isZeroAddress(address: string) {
  return /^0x0{40}$/i.test(address);
}

function formatSeconds(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return `${h}h ${m}m ${r}s`;
}

function isBytes32Zero(v: unknown) {
  return typeof v === 'string' && /^0x0{64}$/i.test(v);
}

export function MinerPanel() {
  const { address, isConnected } = useAccount();
  const signerPromise = useEthersSigner({ chainId: CHAIN_ID });
  const { instance, isLoading: zamaLoading, error: zamaError } = useZamaInstance();

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const contractsReady = !isZeroAddress(MINER_NFT_ADDRESS) && MINER_NFT_ABI.length > 0;

  const { data: tokenIdRaw, refetch: refetchTokenId } = useReadContract({
    address: MINER_NFT_ADDRESS,
    abi: MINER_NFT_ABI as any,
    functionName: 'minerTokenId',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address && contractsReady) },
  });

  const tokenId = useMemo(() => {
    if (typeof tokenIdRaw === 'bigint') return tokenIdRaw;
    return 0n;
  }, [tokenIdRaw]);

  const hasMiner = tokenId > 0n;

  const { data: lastMinedAtRaw, refetch: refetchLastMinedAt } = useReadContract({
    address: MINER_NFT_ADDRESS,
    abi: MINER_NFT_ABI as any,
    functionName: 'lastMinedAt',
    args: hasMiner ? [tokenId] : undefined,
    query: { enabled: Boolean(contractsReady && hasMiner) },
  });

  const { data: nextMineAtRaw, refetch: refetchNextMineAt } = useReadContract({
    address: MINER_NFT_ADDRESS,
    abi: MINER_NFT_ABI as any,
    functionName: 'nextMineAt',
    args: hasMiner ? [tokenId] : undefined,
    query: { enabled: Boolean(contractsReady && hasMiner) },
  });

  const { data: canMineRaw, refetch: refetchCanMine } = useReadContract({
    address: MINER_NFT_ADDRESS,
    abi: MINER_NFT_ABI as any,
    functionName: 'canMine',
    args: hasMiner ? [tokenId] : undefined,
    query: { enabled: Boolean(contractsReady && hasMiner) },
  });

  const { data: powerHandleRaw, refetch: refetchPowerHandle } = useReadContract({
    address: MINER_NFT_ADDRESS,
    abi: MINER_NFT_ABI as any,
    functionName: 'minerPower',
    args: hasMiner ? [tokenId] : undefined,
    query: { enabled: Boolean(contractsReady && hasMiner) },
  });

  const lastMinedAt = typeof lastMinedAtRaw === 'bigint' ? Number(lastMinedAtRaw) : 0;
  const nextMineAt = typeof nextMineAtRaw === 'bigint' ? Number(nextMineAtRaw) : 0;
  const canMine = typeof canMineRaw === 'boolean' ? canMineRaw : false;
  const powerHandle = typeof powerHandleRaw === 'string' ? powerHandleRaw : undefined;

  const remainingSeconds = useMemo(() => {
    if (!hasMiner) return 0;
    if (!nextMineAt) return 0;
    const nowSeconds = Math.floor(now / 1000);
    return Math.max(0, nextMineAt - nowSeconds);
  }, [hasMiner, nextMineAt, now]);

  const [isMinting, setIsMinting] = useState(false);
  const [isMining, setIsMining] = useState(false);

  const [decryptedPower, setDecryptedPower] = useState<bigint | null>(null);
  const [isDecryptingPower, setIsDecryptingPower] = useState(false);

  const refreshAll = useCallback(async () => {
    await refetchTokenId();
    await refetchLastMinedAt();
    await refetchNextMineAt();
    await refetchCanMine();
    await refetchPowerHandle();
  }, [refetchCanMine, refetchLastMinedAt, refetchNextMineAt, refetchPowerHandle, refetchTokenId]);

  const mintMiner = useCallback(async () => {
    if (!contractsReady) {
      alert('Contracts are not configured yet.');
      return;
    }
    if (!signerPromise) {
      alert('Connect your wallet first.');
      return;
    }
    setIsMinting(true);
    try {
      const signer = await signerPromise;
      const miner = new Contract(MINER_NFT_ADDRESS, MINER_NFT_ABI, signer);
      const tx = await miner.mintMiner();
      await tx.wait();
      await refreshAll();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      alert(`Mint failed: ${message}`);
    } finally {
      setIsMinting(false);
    }
  }, [contractsReady, refreshAll, signerPromise]);

  const mine = useCallback(async () => {
    if (!contractsReady) {
      alert('Contracts are not configured yet.');
      return;
    }
    if (!hasMiner) {
      alert('Mint a miner first.');
      return;
    }
    if (!signerPromise) {
      alert('Connect your wallet first.');
      return;
    }
    setIsMining(true);
    try {
      const signer = await signerPromise;
      const miner = new Contract(MINER_NFT_ADDRESS, MINER_NFT_ABI, signer);
      const tx = await miner.mine(tokenId);
      await tx.wait();
      await refreshAll();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      alert(`Mine failed: ${message}`);
    } finally {
      setIsMining(false);
    }
  }, [contractsReady, hasMiner, refreshAll, signerPromise, tokenId]);

  const decryptPower = useCallback(async () => {
    if (!instance || !address || !powerHandle || !signerPromise) {
      alert('Missing requirements for decryption.');
      return;
    }
    if (isBytes32Zero(powerHandle)) {
      setDecryptedPower(0n);
      return;
    }
    setIsDecryptingPower(true);
    try {
      const keypair = instance.generateKeypair();
      const handleContractPairs = [{ handle: powerHandle, contractAddress: MINER_NFT_ADDRESS }];

      const startTimeStamp = Math.floor(Date.now() / 1000).toString();
      const durationDays = '10';
      const contractAddresses = [MINER_NFT_ADDRESS];

      const eip712 = instance.createEIP712(keypair.publicKey, contractAddresses, startTimeStamp, durationDays);
      const signer = await signerPromise;
      const signature = await signer.signTypedData(
        eip712.domain,
        { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
        eip712.message,
      );

      const result = await instance.userDecrypt(
        handleContractPairs,
        keypair.privateKey,
        keypair.publicKey,
        signature.replace('0x', ''),
        contractAddresses,
        address,
        startTimeStamp,
        durationDays,
      );

      const v = result[powerHandle as string];
      setDecryptedPower(BigInt(v));
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      alert(`Decrypt failed: ${message}`);
    } finally {
      setIsDecryptingPower(false);
    }
  }, [address, instance, powerHandle, signerPromise]);

  if (!contractsReady) {
    return (
      <div className="panel">
        <div className="panel-title">Setup required</div>
        <div className="panel-text">
          Deploy the contracts to Sepolia and run <code>npx hardhat task:sync-frontend --network sepolia</code> to generate{' '}
          <code>home/src/config/contracts.ts</code>.
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="panel">
        <div className="panel-title">Connect your wallet</div>
        <div className="panel-text">Use the button in the top right to connect.</div>
      </div>
    );
  }

  return (
    <div className="panel-stack">
      <div className="panel">
        <div className="panel-title">Your Miner</div>
        <div className="grid">
          <div className="kv">
            <div className="k">Token ID</div>
            <div className="v">{hasMiner ? tokenId.toString() : 'None'}</div>
          </div>
          <div className="kv">
            <div className="k">Cooldown</div>
            <div className="v">{hasMiner ? (canMine ? 'Ready' : formatSeconds(remainingSeconds)) : '-'}</div>
          </div>
          <div className="kv">
            <div className="k">Last mined</div>
            <div className="v">{lastMinedAt ? new Date(lastMinedAt * 1000).toLocaleString() : '-'}</div>
          </div>
          <div className="kv">
            <div className="k">Next mine</div>
            <div className="v">{nextMineAt ? new Date(nextMineAt * 1000).toLocaleString() : '-'}</div>
          </div>
        </div>

        <div className="actions">
          {!hasMiner ? (
            <button className="button" onClick={mintMiner} disabled={isMinting}>
              {isMinting ? 'Minting...' : 'Mint Miner NFT'}
            </button>
          ) : (
            <button className="button" onClick={mine} disabled={isMining || !canMine}>
              {isMining ? 'Mining...' : canMine ? 'Mine Gold' : 'Mine (cooldown)'}
            </button>
          )}
          <button className="button button-secondary" onClick={refreshAll} disabled={!isConnected}>
            Refresh
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">Miner Power</div>
        <div className="panel-text">
          Power is generated on-chain as a Zama encrypted random value in the range 100–500, and it determines how much Gold you
          can mine every 24 hours.
        </div>

        <div className="grid">
          <div className="kv">
            <div className="k">Encrypted handle</div>
            <div className="v code">{powerHandle ?? '-'}</div>
          </div>
          <div className="kv">
            <div className="k">Decrypted power</div>
            <div className="v">{decryptedPower === null ? 'Hidden' : decryptedPower.toString()}</div>
          </div>
        </div>

        {zamaError ? <div className="hint error">Zama relayer error: {zamaError}</div> : null}
        <div className="actions">
          <button className="button" onClick={decryptPower} disabled={!hasMiner || !instance || !signerPromise || zamaLoading || isDecryptingPower}>
            {isDecryptingPower ? 'Decrypting...' : zamaLoading ? 'Loading relayer...' : 'Decrypt Power'}
          </button>
          <button className="button button-secondary" onClick={() => setDecryptedPower(null)} disabled={decryptedPower === null}>
            Hide
          </button>
        </div>
      </div>
    </div>
  );
}
