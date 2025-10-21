import { eventLog, handlerContext, TX } from 'generated';

export const createTx = (
  event: eventLog<unknown>,
  context: handlerContext,
  save: boolean = true
) => {
  const tx: TX = {
    id: event.transaction.hash,
    from: event.transaction.from || '',
    block: event.block.number,
    timestamp: event.block.timestamp,
    hash: event.block.hash,
    chainId: event.chainId,
  };

  if (save) {
    context.TX.set(tx);
  }

  return tx;
};

export const _key = {
  event: (event: eventLog<unknown>) =>
    `${event.chainId}_${event.transaction.hash}_${event.logIndex}`,
  beam: ({ poolAddress, to }: { poolAddress: string; to: string }) =>
    `${poolAddress}_${to}`,
  beamPool: ({ poolAddress }: { poolAddress: string }) => poolAddress,
  poolMetadata: ({ poolAddress }: { poolAddress: string }) => poolAddress,
  userAccount: ({ chainId, address }: { chainId: number; address: string }) =>
    `${chainId}_${address}`,
  user: ({ fid }: { fid: number }) => fid.toString(),
  beamR: ({ chainId, address }: { chainId: number; address: string }) =>
    `${chainId}_${address}`,
  role: ({ chainId, roleHash }: { chainId: number; roleHash: string }) =>
    `${chainId}_${roleHash}`,
};
