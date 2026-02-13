import { DistributionUpdated, GDA } from 'generated';
import { _key, createTx } from './utils/sync';

GDA.FlowDistributionUpdated.handler(async ({ event, context }) => {
  const beamPool = await context.BeamPool.get(
    _key.beamPool({ poolAddress: event.params.pool })
  );

  if (!beamPool) {
    return;
  }

  const creatorAccount = await context.UserAccount.get(
    beamPool.creatorAccount_id
  );
  const creatorAddress = creatorAccount?.address?.toLowerCase();
  const distributor = event.params.distributor.toLowerCase();
  const creatorFlowRate =
    creatorAddress && creatorAddress === distributor
      ? event.params.newDistributorToPoolFlowRate
      : beamPool.creatorFlowRate;

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
    timestamp: event.block.timestamp,
  };

  const active =
    event.params.newTotalDistributionFlowRate === BigInt(0) ? false : true;

  const hasDistributed = beamPool.hasDistributed || active ? true : false;

  context.BeamPool.set({
    ...beamPool,
    active,
    adjustmentFlowRate: event.params.adjustmentFlowRate,
    adjustmentMember: event.params.adjustmentFlowRecipient,
    lastDistroUpdate_id: distroUpdate.id,
    flowRate: event.params.newTotalDistributionFlowRate,
    creatorFlowRate,
    lastUpdated: event.block.timestamp,

    hasDistributed,
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
  //

  context.Beam.set({
    ...beam,
    isReceiverConnected: event.params.isConnected,
  });

  createTx(event, context);
});
//
