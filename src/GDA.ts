import { DistributionUpdated, GDA } from 'generated';
import { _key, createTx } from './utils/sync';

GDA.FlowDistributionUpdated.handler(async ({ event, context }) => {
  const beamPool = await context.BeamPool.get(
    _key.beamPool({ poolAddress: event.params.pool })
  );

  if (!beamPool) {
    return;
  }
  context.log.info(
    `Handling FlowDistributionUpdated for pool: ${event.params.pool}, chainId: ${event.chainId}, tx: ${event.transaction.hash}`
  );

  const distroUpdate: DistributionUpdated = {
    id: _key.event(event),
    beamPool_id: event.params.pool,
    distributor: event.params.distributor,
    oldFlowRate: event.params.oldFlowRate,
    operator: event.params.operator,
    newFlowRateFromDistributor: event.params.newDistributorToPoolFlowRate,
    newTotalDistributionFlowRate: event.params.newTotalDistributionFlowRate,
    adjustmentFlowRate: event.params.adjustmentFlowRate,
    adjustmentFlowRecipient: event.params.adjustmentFlowRecipient,
  };

  context.BeamPool.set({
    ...beamPool,
    adjustmentFlowRate: event.params.adjustmentFlowRate,
    adjustmentMember: event.params.adjustmentFlowRecipient,
    lastDistroUpdate_id: distroUpdate.id,
    flowRate: event.params.newTotalDistributionFlowRate,
    lastUpdated: event.block.timestamp,
  });

  context.DistributionUpdated.set(distroUpdate);
  createTx(event, context);
});

GDA.PoolConnectionUpdated.handler(async ({ event, context }) => {
  const beamPool = await context.BeamPool.get(
    _key.beamPool({ poolAddress: event.params.pool })
  );

  if (!beamPool) {
    return;
  }

  const beam = await context.Beam.get(
    _key.beam({
      poolAddress: event.params.pool,
      to: event.params.account,
    })
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
