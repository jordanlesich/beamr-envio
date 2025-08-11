import { Beam, MemberUnitsUpdated, SuperfluidPool, User } from 'generated';
import { createTx } from './utils/sync';

SuperfluidPool.MemberUnitsUpdated.handler(async ({ event, context }) => {
  const beamPool = await context.BeamPool.get(event.srcAddress);

  if (!beamPool) {
    // filter non BeamR pools
    return;
  }

  const beamR = await context.BeamR.get(beamPool.beamR_id);

  if (!beamR) {
    // filter non BeamR pools
    return;
  }

  let receiver = await context.User.get(
    `${event.chainId}_${event.params.member}`
  );

  if (!receiver) {
    receiver = {
      id: `${event.chainId}_${event.params.member}`,
      chainId: event.chainId,
      address: event.params.member,
      fid: undefined, // users will not have fids until they create a pool
    };
  }

  const isIncrease = event.params.newUnits > event.params.oldUnits;
  const netChange = isIncrease
    ? event.params.newUnits - event.params.oldUnits
    : event.params.oldUnits - event.params.newUnits;

  const revertUnitsDoNotExist = !isIncrease && beamPool.totalUnits < netChange;

  if (revertUnitsDoNotExist) {
    context.log.error(
      `Revert units do not exist: beamPool.totalUnits ${beamPool.totalUnits} < netChange ${netChange} on chainId: ${event.chainId} at tx ${event.transaction.hash}`
    );
  }

  let beam = await context.Beam.get(
    `${event.srcAddress}_${event.params.member}`
  );

  if (!beam) {
    beam = {
      id: `${event.srcAddress}_${event.params.member}`,
      chainId: event.chainId,
      from_id: `${event.chainId}_${event.params.member}`,
      to_id: beamPool.creator_id,
      beamPool_id: event.srcAddress,
      units: event.params.newUnits,
      isReceiverConnected: false,
      beamR_id: beamR.id,
    };
  } else {
    beam = {
      ...beam,
      units: event.params.newUnits,
    };
  }

  const memberUnitsUpdated: MemberUnitsUpdated = {
    id: `${event.chainId}_${event.transaction.hash}_${event.logIndex}`,
    beamPool_id: event.srcAddress,
    beam_id: beam.id,
    member: event.params.member,
    oldUnits: event.params.oldUnits,
    newUnits: event.params.newUnits,
  };

  context.MemberUnitsUpdated.set(memberUnitsUpdated);
  context.Beam.set(beam);
  context.User.set(receiver);
  context.Beam.set(beam);
  context.BeamPool.set({
    ...beamPool,
    lastUpdated: event.block.timestamp,
    totalUnits: isIncrease
      ? beamPool.totalUnits + netChange
      : beamPool.totalUnits - netChange,
  });

  createTx(event, context);
});
