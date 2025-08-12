/*
 * Please refer to https://docs.envio.dev for a thorough guide on all Envio indexer features
 */
import {
  BeamR,
  BeamR_Initialized,
  BeamR_PoolCreated,
  BeamR_PoolMetadataUpdated,
  BeamR_RoleGranted,
  BeamR_RoleRevoked,
} from 'generated';
import { createTx } from './utils/sync';
import {
  BeamPool,
  beamR,
  PoolMetadata,
  Role,
  User,
  VanityMetrics,
} from 'generated/src/Types.gen';
import { ONCHAIN_EVENT, poolMetadataSchema } from './validation/poolMetadata';

const VANITY_METRICS = 'VANITY_METRICS';

BeamR.Initialized.handler(async ({ event, context }) => {
  const tx = createTx(event, context, false);

  const VanityMetrics: VanityMetrics = {
    id: VANITY_METRICS,
    users: 0,
    beamPools: 0,
    beams: 0,
  };

  const adminRole: Role = {
    id: `${event.chainId}_${event.params.adminRole}`,
    chainId: event.chainId,
    roleHash: event.params.adminRole,
    beamPool_id: undefined,
    beamR_id: `${event.chainId}_${event.srcAddress}`,
    admins: [],
  };

  const rootAdminRole: Role = {
    id: `${event.chainId}_${event.params.rootAdminRole}`,
    chainId: event.chainId,
    roleHash: event.params.rootAdminRole,
    beamPool_id: undefined,
    beamR_id: `${event.chainId}_${event.srcAddress}`,
    admins: [],
  };

  const beamR: beamR = {
    id: `${event.chainId}_${event.srcAddress}`,
    chainId: event.chainId,
    adminRole_id: adminRole.id,
    rootAdminRole_id: rootAdminRole.id,
  };
  const entity: BeamR_Initialized = {
    id: `${event.chainId}_${event.transaction.hash}_${event.logIndex}`,
    adminRole: event.params.adminRole,
    rootAdminRole: event.params.rootAdminRole,
    tx_id: tx.id,
  };

  context.BeamR.set(beamR);
  context.VanityMetrics.set(VanityMetrics);
  context.BeamR_Initialized.set(entity);
  context.Role.set(adminRole);
  context.Role.set(rootAdminRole);
  context.TX.set(tx);
});

BeamR.PoolCreated.contractRegister(async ({ event, context }) => {
  context.addSuperfluidPool(event.params.pool);
});

BeamR.PoolCreated.handler(async ({ event, context }) => {
  const tx = createTx(event, context, false);
  const vanityMetrics = await context.VanityMetrics.get(VANITY_METRICS);

  if (event.params.metadata[0] !== ONCHAIN_EVENT) {
    context.log.error(
      `Invalid metadata for pool creation event on chainId: ${event.chainId} at tx ${event.transaction.hash}`
    );
    return;
  }
  const parsedJSON = safeJSONParse(event.params.metadata[1]);

  if (!parsedJSON) {
    context.log.error(
      `Failed to parse pool metadata JSON on chainId: ${event.chainId} at tx ${event.transaction.hash}`
    );
    return;
  }
  const validated = poolMetadataSchema.safeParse(
    JSON.parse(event.params.metadata[1])
  );

  if (!validated.success) {
    context.log.error(
      `Invalid pool metadata schema on chainId: ${event.chainId} at tx ${event.transaction.hash}: ${validated.error}`
    );
    return;
  }

  const metadata: PoolMetadata = {
    id: event.params.pool,
    creatorFID: validated.data.creatorFID,
    poolType: validated.data.poolType,
    name: validated.data.name,
    description: validated.data.description || undefined,
    castHash: validated.data.castHash || undefined,
    instructions: validated.data.instructions || undefined,
  };

  const creator: User = {
    id: `${event.chainId}_${event.params.creator}`,
    chainId: event.chainId,
    address: event.params.creator,
    fid: metadata.creatorFID,
  };

  const poolAdminRole: Role = {
    id: `${event.chainId}_${event.params.poolAdminRole}`,
    chainId: event.chainId,
    roleHash: event.params.poolAdminRole,
    beamPool_id: event.params.pool,
    beamR_id: `${event.chainId}_${event.srcAddress}`,
    admins: [event.params.creator],
  };

  const BeamPool: BeamPool = {
    id: event.params.pool,
    chainId: event.chainId,
    beamR_id: `${event.chainId}_${event.srcAddress}`,
    creator_id: event.params.creator,
    token: event.params.token,
    beamCount: 0,
    totalUnits: 0n,
    flowRate: 0n,
    poolAdminRole_id: event.params.poolAdminRole,
    lastDistroUpdate_id: undefined,
    lastUpdated: event.block.timestamp,
    metadata_id: event.params.pool,
  };

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

  if (!vanityMetrics) {
    context.log.error(`VanityMetrics not found on chainId: ${event.chainId}`);
    return;
  }

  const newMetrics: VanityMetrics = {
    ...vanityMetrics,
    users: vanityMetrics.users + 1,
    beamPools: vanityMetrics.beamPools + 1,
  };

  context.Role.set(poolAdminRole);
  context.BeamR_PoolCreated.set(entity);
  context.BeamPool.set(BeamPool);
  context.User.set(creator);
  context.VanityMetrics.set(newMetrics);
  context.PoolMetadata.set(metadata);

  context.TX.set(tx);
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
  context.TX.set(tx);
});

BeamR.RoleGranted.handler(async ({ event, context }) => {
  const tx = createTx(event, context, false);
  const role = await context.Role.get(`${event.chainId}_${event.params.role}`);

  if (!role) {
    context.log.warn(
      `Role not found for role hash: ${event.params.role} on chainId: ${event.chainId}`
    );
    return;
  }

  context.Role.set({
    ...role,
    admins: [...role.admins, event.params.account],
  });

  const entity: BeamR_RoleGranted = {
    id: `${event.chainId}_${event.transaction.hash}_${event.logIndex}`,
    role: event.params.role,
    account: event.params.account,
    sender: event.params.sender,
    tx_id: tx.id,
  };

  context.BeamR_RoleGranted.set(entity);
  context.TX.set(tx);
});

BeamR.RoleRevoked.handler(async ({ event, context }) => {
  const tx = createTx(event, context, false);
  const role = await context.Role.get(`${event.chainId}_${event.params.role}`);

  if (!role) {
    context.log.warn(
      `Role not found for role hash: ${event.params.role} on chainId: ${event.chainId}`
    );
    return;
  }

  context.Role.set({
    ...role,
    admins: role.admins.filter((admin) => admin !== event.params.account),
  });

  const entity: BeamR_RoleRevoked = {
    id: `${event.chainId}_${event.transaction.hash}_${event.logIndex}`,
    role: event.params.role,
    account: event.params.account,
    sender: event.params.sender,
    tx_id: tx.id,
  };

  context.BeamR_RoleRevoked.set(entity);
  context.TX.set(tx);
});
