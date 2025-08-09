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
import { createTx, saveTx } from './utils/sync';
import { beamR, VanityMetrics } from 'generated/src/Types.gen';

BeamR.Initialized.handler(async ({ event, context }) => {
  const tx = createTx(event, context, false);

  const VanityMetrics: VanityMetrics = {
    id: 'VANITY_METRICS',
    users: 0,
    beamPools: 0,
    beams: 0,
  };
  const beamR: beamR = {
    id: `${event.chainId}_${event.srcAddress}`,
    chainId: event.chainId,
    admins: [],
    rootAdmins: [],
    adminRole: event.params.adminRole,
    rootAdminRole: event.params.rootAdminRole,
  };
  const entity: BeamR_Initialized = {
    id: `${event.chainId}_${event.transaction.hash}_${event.logIndex}`,
    adminRole: event.params.adminRole,
    rootAdminRole: event.params.rootAdminRole,
    tx_id: tx.id,
  };

  saveTx(event, context);
  context.BeamR.set(beamR);
  context.VanityMetrics.set(VanityMetrics);
  context.BeamR_Initialized.set(entity);
});

BeamR.PoolCreated.handler(async ({ event, context }) => {
  const tx = createTx(event, context, false);
  const entity: BeamR_PoolCreated = {
    id: `${event.chainId}_${event.transaction.hash}_${event.logIndex}`,
    pool: event.params.pool,
    token: event.params.token,
    config_0: event.params.config[0],
    config_1: event.params.config[1],
    creator: event.params.creator,
    poolAdminRole: event.params.poolAdminRole,
    metadata_0: event.params.metadata[0],
    metadata_1: event.params.metadata[1],
    tx_id: tx.id,
  };

  context.BeamR_PoolCreated.set(entity);

  saveTx(event, context);
});

BeamR.PoolMetadataUpdated.handler(async ({ event, context }) => {
  const tx = createTx(event, context, false);
  const entity: BeamR_PoolMetadataUpdated = {
    id: `${event.chainId}_${event.transaction.hash}_${event.logIndex}`,
    pool: event.params.pool,
    metadata_0: event.params.metadata[0],
    metadata_1: event.params.metadata[1],
    tx_id: tx.id,
  };

  context.BeamR_PoolMetadataUpdated.set(entity);
  saveTx(event, context);
});

BeamR.RoleAdminChanged.handler(async ({ event, context }) => {
  const tx = createTx(event, context, false);
  const entity: BeamR_RoleAdminChanged = {
    id: `${event.chainId}_${event.transaction.hash}_${event.logIndex}`,
    role: event.params.role,
    previousAdminRole: event.params.previousAdminRole,
    newAdminRole: event.params.newAdminRole,
    tx_id: tx.id,
  };

  context.BeamR_RoleAdminChanged.set(entity);
  saveTx(event, context);
});

BeamR.RoleGranted.handler(async ({ event, context }) => {
  const tx = createTx(event, context, false);
  const entity: BeamR_RoleGranted = {
    id: `${event.chainId}_${event.transaction.hash}_${event.logIndex}`,
    role: event.params.role,
    account: event.params.account,
    sender: event.params.sender,
    tx_id: tx.id,
  };

  context.BeamR_RoleGranted.set(entity);
  saveTx(event, context);
});

BeamR.RoleRevoked.handler(async ({ event, context }) => {
  const tx = createTx(event, context, false);
  const entity: BeamR_RoleRevoked = {
    id: `${event.chainId}_${event.transaction.hash}_${event.logIndex}`,
    role: event.params.role,
    account: event.params.account,
    sender: event.params.sender,
    tx_id: tx.id,
  };

  context.BeamR_RoleRevoked.set(entity);
  saveTx(event, context);
});
