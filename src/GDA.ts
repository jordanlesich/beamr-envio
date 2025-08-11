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
  });

  context.DistributionUpdated.set(distroUpdate);

  createTx(event, context);
});

GDA.PoolConnectionUpdated.handler(async ({ event, context }) => {});
