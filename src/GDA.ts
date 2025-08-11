import { DistributionUpdated, GDA } from 'generated';
import { createTx } from './utils/sync';

GDA.FlowDistributionUpdated.handler(async ({ event, context }) => {
  const beamPool = await context.BeamPool.get(event.params.pool);

  if (!beamPool) {
    return;
  }

  context.BeamPool.set({
    ...beamPool,
  });

  const distroUpdate: DistributionUpdated = {
    id: `${event.chainId}_${event.transaction.hash}_${event.logIndex}`,
    beamPool_id: event.params.pool,
    distributor: event.params.distributor,
    oldFlowRate: event.params.oldFlowRate,
    newFlowRateFromDistributor: event.params.newDistributorToPoolFlowRate,
    newTotalFlowRate: event.params.newTotalDistributionFlowRate,
  };

  context.BeamPool.set({
    ...beamPool,
    lastDistroUpdate_id: distroUpdate.id,
    flowRate: event.params.newTotalDistributionFlowRate,
    lastUpdated: event.block.timestamp,
  });

  context.DistributionUpdated.set(distroUpdate);

  createTx(event, context);
});

GDA.PoolConnectionUpdated.handler(async ({ event, context }) => {
  const beamPool = await context.BeamPool.get(event.params.pool);

  if (!beamPool) {
    return;
  }

  const beam = await context.Beam.get(
    `${event.params.pool}_${event.params.account}`
  );

  if (!beam) {
    context.log.error(
      `Beam not found for beamPool: ${event.params.pool} and account: ${event.params.account} on chainId: ${event.chainId} at tx ${event.transaction.hash}`
    );
    return;
  }

  context.Beam.set({
    ...beam,
    isReceiverConnected: event.params.isConnected,
  });

  createTx(event, context);
});
