/*
 * Please refer to https://docs.envio.dev for a thorough guide on all Envio indexer features
 */
import {
  BeamR,
  BeamR_Initialized,
  BeamR_PoolCreated,
  BeamR_PoolMetadataUpdated,
  BeamR_RoleAdminChanged,
  BeamR_RoleGranted,
  BeamR_RoleRevoked,
} from 'generated';

BeamR.Initialized.handler(async ({ event, context }) => {
  // event.transaction.hash;
  event.transaction.from;
  event.block.number;
  event.block.timestamp;
  event.block.hash;

  context.TX.set({
    id: event.transaction.hash,
    from: event.transaction.from || '',
    block: event.block.number,
    timestamp: event.block.timestamp,
    hash: event.block.hash,
    chainId: event.chainId,
  });

  const entity: BeamR_Initialized = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    adminRole: event.params.adminRole,
    rootAdminRole: event.params.rootAdminRole,
    tx_id: event.transaction.hash,
  };

  context.BeamR_Initialized.set(entity);
});

BeamR.PoolCreated.handler(async ({ event, context }) => {
  const entity: BeamR_PoolCreated = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    pool: event.params.pool,
    token: event.params.token,
    config_0: event.params.config[0],
    config_1: event.params.config[1],
    creator: event.params.creator,
    poolAdminRole: event.params.poolAdminRole,
    metadata_0: event.params.metadata[0],
    metadata_1: event.params.metadata[1],
  };

  context.BeamR_PoolCreated.set(entity);
});

BeamR.PoolMetadataUpdated.handler(async ({ event, context }) => {
  const entity: BeamR_PoolMetadataUpdated = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    pool: event.params.pool,
    metadata_0: event.params.metadata[0],
    metadata_1: event.params.metadata[1],
  };

  context.BeamR_PoolMetadataUpdated.set(entity);
});

BeamR.RoleAdminChanged.handler(async ({ event, context }) => {
  const entity: BeamR_RoleAdminChanged = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    role: event.params.role,
    previousAdminRole: event.params.previousAdminRole,
    newAdminRole: event.params.newAdminRole,
  };

  context.BeamR_RoleAdminChanged.set(entity);
});

BeamR.RoleGranted.handler(async ({ event, context }) => {
  const entity: BeamR_RoleGranted = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    role: event.params.role,
    account: event.params.account,
    sender: event.params.sender,
  };

  context.BeamR_RoleGranted.set(entity);
});

BeamR.RoleRevoked.handler(async ({ event, context }) => {
  const entity: BeamR_RoleRevoked = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    role: event.params.role,
    account: event.params.account,
    sender: event.params.sender,
  };

  context.BeamR_RoleRevoked.set(entity);
});
