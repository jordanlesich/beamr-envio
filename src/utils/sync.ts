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

export const saveTx = (event: eventLog<unknown>, context: handlerContext) =>
  createTx(event, context, true);
