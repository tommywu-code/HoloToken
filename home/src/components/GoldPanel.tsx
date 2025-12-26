import { useCallback, useState } from 'react';
import { useAccount, useReadContract } from 'wagmi';

import { useEthersSigner } from '../hooks/useEthersSigner';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { CHAIN_ID, CONFIDENTIAL_GOLD_ABI, CONFIDENTIAL_GOLD_ADDRESS } from '../config/contracts';

import '../styles/Panel.css';

function isZeroAddress(address: string) {
  return /^0x0{40}$/i.test(address);
}

function isBytes32Zero(v: unknown) {
  return typeof v === 'string' && /^0x0{64}$/i.test(v);
}

export function GoldPanel() {
  const { address, isConnected } = useAccount();
  const signerPromise = useEthersSigner({ chainId: CHAIN_ID });
  const { instance, isLoading: zamaLoading, error: zamaError } = useZamaInstance();

  const contractsReady = !isZeroAddress(CONFIDENTIAL_GOLD_ADDRESS) && CONFIDENTIAL_GOLD_ABI.length > 0;

  const { data: balanceHandleRaw, refetch: refetchBalance } = useReadContract({
    address: CONFIDENTIAL_GOLD_ADDRESS,
    abi: CONFIDENTIAL_GOLD_ABI as any,
    functionName: 'confidentialBalanceOf',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address && contractsReady) },
  });

  const balanceHandle = typeof balanceHandleRaw === 'string' ? balanceHandleRaw : undefined;

  const [decryptedBalance, setDecryptedBalance] = useState<bigint | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);

  const decryptBalance = useCallback(async () => {
    if (!instance || !address || !balanceHandle || !signerPromise) {
      alert('Missing requirements for decryption.');
      return;
    }
    if (isBytes32Zero(balanceHandle)) {
      setDecryptedBalance(0n);
      return;
    }
    setIsDecrypting(true);
    try {
      const keypair = instance.generateKeypair();
      const handleContractPairs = [{ handle: balanceHandle, contractAddress: CONFIDENTIAL_GOLD_ADDRESS }];

      const startTimeStamp = Math.floor(Date.now() / 1000).toString();
      const durationDays = '10';
      const contractAddresses = [CONFIDENTIAL_GOLD_ADDRESS];

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

      const v = result[balanceHandle as string];
      setDecryptedBalance(BigInt(v));
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      alert(`Decrypt failed: ${message}`);
    } finally {
      setIsDecrypting(false);
    }
  }, [address, balanceHandle, instance, signerPromise]);

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
        <div className="panel-title">Gold Balance</div>

        <div className="grid">
          <div className="kv">
            <div className="k">Encrypted handle</div>
            <div className="v code">{balanceHandle ?? '-'}</div>
          </div>
          <div className="kv">
            <div className="k">Decrypted balance</div>
            <div className="v">{decryptedBalance === null ? 'Hidden' : decryptedBalance.toString()}</div>
          </div>
        </div>

        {zamaError ? <div className="hint error">Zama relayer error: {zamaError}</div> : null}
        <div className="actions">
          <button className="button" onClick={decryptBalance} disabled={!instance || !signerPromise || zamaLoading || isDecrypting}>
            {isDecrypting ? 'Decrypting...' : zamaLoading ? 'Loading relayer...' : 'Decrypt Balance'}
          </button>
          <button className="button button-secondary" onClick={() => setDecryptedBalance(null)} disabled={decryptedBalance === null}>
            Hide
          </button>
          <button className="button button-secondary" onClick={() => refetchBalance()} disabled={!address}>
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
}
