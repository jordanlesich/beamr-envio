/*
 * Please refer to https://docs.envio.dev for a thorough guide on all Envio indexer features
 */
import {
  BeamR,
  BeamR_RoleGranted,
  BeamR_Initialized,
  BeamR_RoleRevoked,
} from 'generated';
import { _key, createTx } from './utils/sync';
import {
  Beam,
  BeamPool,
  BeamrGlobal,
  PoolMetadata,
  Role,
  User,
  UserAccount,
} from 'generated/src/Types.gen';
import {
  Action,
  ONCHAIN_EVENT,
  poolMetadataSchema,
  unitAdjustmentSchema,
} from './validation/poolMetadata';
import { safeJSONParse } from './utils/common';
import { zeroAddress } from 'viem';
import { decodeReceiptKey } from './utils/keys';
import { HandlerContext } from 'generated/src/Types';

BeamR.Initialized.handler(async ({ event, context }) => {
  const tx = createTx(event, context, false);

  const adminRole: Role = {
    id: _key.role({ chainId: event.chainId, roleHash: event.params.adminRole }),
    chainId: event.chainId,
    roleHash: event.params.adminRole,
    beamPool_id: undefined,
    beamR_id: _key.beamR({ chainId: event.chainId, address: event.srcAddress }),
    admins: [],
  };
  //
  const rootAdminRole: Role = {
    id: _key.role({
      chainId: event.chainId,
      roleHash: event.params.rootAdminRole,
    }),
    chainId: event.chainId,
    roleHash: event.params.rootAdminRole,
    beamPool_id: undefined,
    beamR_id: _key.beamR({ chainId: event.chainId, address: event.srcAddress }),
    admins: [],
  };

  const beamR: BeamrGlobal = {
    id: _key.beamR({
      chainId: event.chainId,
      address: event.srcAddress,
    }),
    chainId: event.chainId,
    adminRole_id: adminRole.id,
    rootAdminRole_id: rootAdminRole.id,
  };
  const entity: BeamR_Initialized = {
    id: _key.event(event),
    adminRole: event.params.adminRole,
    rootAdminRole: event.params.rootAdminRole,
    tx_id: tx.id,
  };

  context.BeamrGlobal.set(beamR);
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

  const { creatorFID, poolType, name, description, receiptKeys } =
    validated.data;

  const fidRouting = receiptKeys.map((key) => {
    if (!key.includes('tip_start')) {
      context.log.error(
        `Invalid receipt key for pool creation event on chainId: ${event.chainId} at tx ${event.transaction.hash}`
      );
      return;
    }

    const { senderFID, receiverFID } = decodeReceiptKey('start', key);
    //

    if (
      !receiverFID ||
      !senderFID ||
      typeof receiverFID !== 'number' ||
      typeof senderFID !== 'number'
    ) {
      context.log.error(
        `Failed to decode receipt key for pool creation event on chainId: ${event.chainId} at tx ${event.transaction.hash}
        
         key: ${key}

        `
      );
      return;
    }

    return [senderFID, receiverFID];
  }) as [number, number][];

  if (fidRouting.length !== event.params.members.length) {
    context.log.error(
      `Mismatch between fidRouting length and members length on chainId: ${event.chainId} at tx ${event.transaction.hash}`
    );
    return;
  }

  const membersData = event.params.members.map((member, index) => {
    return {
      address: member[0],
      fid: fidRouting[index][1],
      units: member[1],
    };
  });

  const metadata: PoolMetadata = {
    id: _key.poolMetadata({
      poolAddress: event.params.pool,
    }),
    creatorFID: creatorFID,
    poolType: poolType,
    name: name,
    description: description || undefined,
    castHash: undefined,
    instructions: undefined,
  };

  const poolAdminRole: Role = {
    id: _key.role({
      chainId: event.chainId,
      roleHash: event.params.poolAdminRole,
    }),
    chainId: event.chainId,
    roleHash: event.params.poolAdminRole,
    beamPool_id: event.params.pool,
    beamR_id: `${event.chainId}_${event.srcAddress}`,
    admins: [],
  };

  const BeamPool: BeamPool = {
    id: _key.beamPool({
      poolAddress: event.params.pool,
    }),
    chainId: event.chainId,
    beamR_id: _key.beamR({
      chainId: event.chainId,
      address: event.srcAddress,
    }),
    creator_id: _key.user({ fid: creatorFID }),
    creatorAccount_id: _key.userAccount({
      chainId: event.chainId,
      address: event.params.creator,
    }),
    token: event.params.token,
    beamCount: membersData.length,
    totalUnits: membersData.reduce((acc, member) => acc + member.units, 0n),
    active: false,
    flowRate: 0n,
    adjustmentFlowRate: 0n,
    adjustmentMember: zeroAddress,
    poolAdminRole_id: _key.role({
      roleHash: event.params.poolAdminRole,
      chainId: event.chainId,
    }),
    lastDistroUpdate_id: undefined,
    lastUpdated: event.block.timestamp,
    metadata_id: event.params.pool,
  };

  context.User.set({
    id: _key.user({ fid: creatorFID }),
    fid: creatorFID,
  });

  context.UserAccount.set({
    id: _key.userAccount({
      chainId: event.chainId,
      address: event.params.creator,
    }),
    chainId: event.chainId,
    address: event.params.creator,
    user_id: _key.user({ fid: creatorFID }),
  });

  context.Role.set(poolAdminRole);
  context.BeamPool.set(BeamPool);
  context.PoolMetadata.set(metadata);
  context.TX.set(tx);

  membersData.forEach(async (memberData, index) => {
    context.User.set({
      id: _key.user({ fid: memberData.fid }),
      fid: memberData.fid,
      // profile_id: _key.profile({ fid: memberData.fid }),
    });

    context.UserAccount.set({
      id: _key.userAccount({
        chainId: event.chainId,
        address: memberData.address,
      }),
      chainId: event.chainId,
      address: memberData.address,
      user_id: _key.user({ fid: memberData.fid }),
    });

    context.Beam.set({
      id: _key.beam({
        poolAddress: event.params.pool,
        to: memberData.address,
      }),
      chainId: event.chainId,
      from_id: _key.user({ fid: creatorFID }),
      to_id: _key.user({ fid: memberData.fid }),
      beamPool_id: _key.beamPool({
        poolAddress: event.params.pool,
      }),
      recipientAccount_id: _key.userAccount({
        chainId: event.chainId,
        address: memberData.address,
      }),
      units: memberData.units,
      isReceiverConnected: false,
      beamR_id: _key.beamR({
        chainId: event.chainId,
        address: event.srcAddress,
      }),
      lastUpdated: event.block.timestamp,
    });
  });
});

BeamR.PoolMetadataUpdated.handler(async ({ event, context }) => {
  const tx = createTx(event, context, false);

  if (event.params.metadata[0] !== ONCHAIN_EVENT) {
    context.log.error(
      `Invalid metadata for pool metadata update event on chainId: ${event.chainId} at tx ${event.transaction.hash}`
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
    id: _key.poolMetadata({
      poolAddress: event.params.pool,
    }),
    creatorFID: validated.data.creatorFID,
    poolType: validated.data.poolType,
    name: validated.data.name,
    description: validated.data.description || undefined,
    castHash: validated.data.castHash || undefined,
    instructions: validated.data.instructions || undefined,
  };

  context.PoolMetadata.set(metadata);

  context.TX.set(tx);
});

BeamR.RoleGranted.handler(async ({ event, context }) => {
  const tx = createTx(event, context, false);
  const role = await context.Role.get(
    _key.role({
      chainId: event.chainId,
      roleHash: event.params.role,
    })
  );

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
    id: _key.event(event),
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
  const role = await context.Role.get(
    _key.role({
      chainId: event.chainId,
      roleHash: event.params.role,
    })
  );

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
    id: _key.event(event),
    role: event.params.role,
    account: event.params.account,
    sender: event.params.sender,
    tx_id: tx.id,
  };

  context.BeamR_RoleRevoked.set(entity);
  context.TX.set(tx);
});

const consolidateOrders = async ({
  members,
  fidRoutes,
  poolAddresses,
  context,
  chainId,
  action,
  timestamp,
  srcAddress,
}: {
  chainId: number;
  members: [string, bigint][];
  fidRoutes: [number, number][];
  poolAddresses: string[];
  context: HandlerContext;
  action: Action;
  timestamp: number;
  srcAddress: string;
}) => {
  // 1. Map Inputs to Deterministic IDs & Structures
  const rawOrders = members.map((member, i) => ({
    poolAddress: poolAddresses[i],
    address: member[0],
    amount: member[1],
    senderFid: fidRoutes[i][0],
    receiverFid: fidRoutes[i][1],
    beamId: _key.beam({ poolAddress: poolAddresses[i], to: member[0] }),
    poolId: _key.beamPool({ poolAddress: poolAddresses[i] }),
    userId: _key.user({ fid: fidRoutes[i][1] }),
    accountId: _key.userAccount({ chainId, address: member[0] }),
  }));

  // Deduplicate IDs
  const uniqueBeamIds = [...new Set(rawOrders.map((o) => o.beamId))];
  const uniquePoolIds = [...new Set(rawOrders.map((o) => o.poolId))];
  const uniqueFids = [
    ...new Set(rawOrders.flatMap((o) => [o.senderFid, o.receiverFid])),
  ];
  const uniqueAccountIds = [...new Set(rawOrders.map((o) => o.accountId))];

  // 2. Batch Read: Fetch EVERYTHING in parallel using standard .get()
  const [existingBeams, existingPools, existingUsers, existingAccounts] =
    await Promise.all([
      Promise.all(uniqueBeamIds.map((id) => context.Beam.get(id))),
      Promise.all(uniquePoolIds.map((id) => context.BeamPool.get(id))),
      Promise.all(
        uniqueFids.map((fid) => context.User.get(_key.user({ fid })))
      ),
      Promise.all(uniqueAccountIds.map((id) => context.UserAccount.get(id))),
    ]);

  // Create Lookup Maps
  const beamMap = new Map();
  existingBeams.forEach((b) => {
    if (b) beamMap.set(b.id, b);
  });

  const poolMap = new Map();
  existingPools.forEach((p) => {
    if (p) poolMap.set(p.id, p);
  });

  const userMap = new Map();
  existingUsers.forEach((u) => {
    if (u) userMap.set(u.fid, u);
  });

  const accountMap = new Map();
  existingAccounts.forEach((a) => {
    if (a) accountMap.set(a.id, a);
  });

  // 3. Prepare Writes containers
  const beamsToSet: Beam[] = [];
  const poolsToSet: Map<string, BeamPool> = new Map();
  const usersToSet: User[] = [];
  const accountsToSet: UserAccount[] = [];

  // 4. Calculate Logic
  for (const order of rawOrders) {
    // --- Entity Checks ---
    if (!userMap.has(order.receiverFid)) {
      const newUser = { id: order.userId, fid: order.receiverFid };
      usersToSet.push(newUser);
      userMap.set(order.receiverFid, newUser); // Update map so we don't add duplicates
    }

    // Check sender as well (just in case)
    if (!userMap.has(order.senderFid)) {
      const newSender = {
        id: _key.user({ fid: order.senderFid }),
        fid: order.senderFid,
      };
      usersToSet.push(newSender);
      userMap.set(order.senderFid, newSender);
    }

    if (!accountMap.has(order.accountId)) {
      const newAccount = {
        id: order.accountId,
        chainId,
        address: order.address,
        user_id: order.userId,
      };
      accountsToSet.push(newAccount);
      accountMap.set(order.accountId, newAccount);
    }

    const previousBeam = beamMap.get(order.beamId);

    const pool = poolsToSet.get(order.poolId) || poolMap.get(order.poolId);

    if (!pool) {
      throw new Error(`Pool not found for address ${order.poolAddress}`);
    }

    const oldUnits = previousBeam ? previousBeam.units : 0n;
    let newUnits = 0n;

    if (action === Action.Update) {
      newUnits = order.amount;
    } else if (action === Action.Increase) {
      newUnits = oldUnits + order.amount;
    } else if (action === Action.Decrease) {
      newUnits = oldUnits - order.amount;
      if (newUnits < 0n) newUnits = 0n;
    }

    // Calculate Delta
    const unitDelta = newUnits - oldUnits;

    // Calculate Beam Count Delta
    let beamCountDelta = 0;
    if (oldUnits === 0n && newUnits > 0n) beamCountDelta = 1;
    else if (oldUnits > 0n && newUnits === 0n) beamCountDelta = -1;

    // --- Prepare Beam Object ---
    const updatedBeam: Beam = {
      ...(previousBeam || {}),
      id: order.beamId,
      chainId,
      units: newUnits,
      lastUpdated: timestamp,
      // Only set these if it's a NEW beam
      ...(!previousBeam && {
        from_id: _key.user({ fid: order.senderFid }),
        to_id: _key.user({ fid: order.receiverFid }),
        beamPool_id: order.poolId,
        recipientAccount_id: order.accountId,
        isReceiverConnected: false,
        beamR_id: _key.beamR({ chainId, address: srcAddress }),
      }),
    };

    beamsToSet.push(updatedBeam);
    beamMap.set(order.beamId, updatedBeam); // Update map for next iteration

    // --- Update Pool Object ---
    const updatedPool = {
      ...pool,
      totalUnits: (pool.totalUnits || 0n) + unitDelta,
      beamCount: (pool.beamCount || 0) + beamCountDelta,
      lastUpdated: timestamp,
    };
    poolsToSet.set(order.poolId, updatedPool);
  }

  return {
    usersToSet,
    accountsToSet,
    beamsToSet,
    poolsToSet: Array.from(poolsToSet.values()),
  };
};

BeamR.MemberUnitsUpdated.handler(async ({ event, context }) => {
  //
  context.log.info(
    `Processing MemberUnitsUpdated event on chainId: ${event.chainId} at tx ${event.transaction.hash}`
  );
  const tx = createTx(event, context, false);
  const {
    action: actionParam,
    metadata,
    members,
    poolAddresses,
  } = event.params;
  if (!Object.values(Action).includes(Number(actionParam))) {
    context.log.error(
      `Invalid action type for MemberUnitsUpdated event on chainId: ${event.chainId} at tx ${event.transaction.hash}`
    );
    return;
  }
  const action = Number(actionParam) as Action;
  if (metadata[0] !== ONCHAIN_EVENT) {
    context.log.error(
      `Invalid metadata for pool creation event on chainId: ${event.chainId} at tx ${event.transaction.hash}`
    );
    return;
  }
  const parsedJSON = safeJSONParse(metadata[1]);
  if (!parsedJSON) {
    context.log.error(
      `Failed to parse pool metadata JSON on chainId: ${event.chainId} at tx ${event.transaction.hash}`
    );
    return;
  }
  const validated = unitAdjustmentSchema.safeParse(JSON.parse(metadata[1]));
  if (!validated.success) {
    context.log.error(
      `Invalid pool metadata schema on chainId: ${event.chainId} at tx ${event.transaction.hash}: ${validated.error}`
    );
    return;
  }
  const { fidRouting } = validated.data;
  if (fidRouting.length !== members.length) {
    context.log.error(
      `Mismatch between fidRouting length and members length on chainId: ${event.chainId} at tx ${event.transaction.hash}`
    );
    return;
  }
  if (
    members.length !== poolAddresses.length ||
    fidRouting.length !== poolAddresses.length
  ) {
    context.log.error(
      `Mismatch between members length and poolAddresses length on chainId: ${event.chainId} at tx ${event.transaction.hash}`
    );
    return;
  }
  const { usersToSet, accountsToSet, beamsToSet, poolsToSet } =
    await consolidateOrders({
      members,
      fidRoutes: fidRouting,
      poolAddresses,
      context,
      chainId: event.chainId,
      action,
      timestamp: event.block.timestamp,
      srcAddress: event.srcAddress, // Passed here
    });

  for (const user of usersToSet) {
    context.User.set(user);
  }

  for (const account of accountsToSet) {
    context.UserAccount.set(account);
  }

  // Set Beams
  for (const beam of beamsToSet) {
    context.Beam.set(beam);
  }

  // Set Pools (Totals)
  for (const pool of poolsToSet) {
    context.BeamPool.set(pool);
  }

  // Set Transaction
  context.TX.set(tx);
});
