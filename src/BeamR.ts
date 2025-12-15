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
// import { getFcProfile } from './effects/getFcProfile';
import { decodeReceiptKey } from './utils/keys';
import { HandlerContext } from 'generated/src/Types';

//
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

  // const [creatorProfile, ...memberProfiles] = await getFcProfile([
  //   creatorFID,
  //   ...membersData.map((m) => m.fid),
  // ]);

  // await context.effect(
  //   getFcProfile,
  //   [creatorFID, ...membersData.map((m) => m.fid)]
  // );

  //
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
    allRecipients: membersData.map((member) => member.address),
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

// const consolidateOrders = async ({
//   members,
//   fidRoutes,
//   poolAddresses,
//   context,
//   chainId,
// }: {
//   chainId: number;
//   members: [string, bigint][];
//   fidRoutes: [number, number][];
//   poolAddresses: string[];
//   context: HandlerContext;
// }) => {
//   const rawOrders = members.map((member, index) => {
//     return {
//       poolAddress: poolAddresses[index],
//       address: member[0],
//       senderFid: fidRoutes[index][0],
//       receiverFid: fidRoutes[index][1],
//       units: member[1],
//     };
//   });

//   const consolidatedPoolAddress = [...new Set(poolAddresses)];

//   const senders = [...new Set(rawOrders.map((order) => order.senderFid))];
//   const receivers = [...new Set(rawOrders.map((order) => order.receiverFid))];
//   const receiverAddress = [...new Set(rawOrders.map((order) => order.address))];
//   const fids = [...new Set([...senders, ...receivers])];

//   const poolResult = await Promise.all(
//     consolidatedPoolAddress.map((poolAddress) =>
//       context.BeamPool.get(_key.beamPool({ poolAddress }))
//     )
//   );

//   if (!poolResult.every((pool) => pool !== undefined)) {
//     context.log.error(
//       `One or more BeamPools not found during order consolidation`
//     );
//     return;
//   }

//   const potentialUsers = await Promise.all(
//     fids.map((fid) => context.User.get(_key.user({ fid })))
//   );

//   const potentialAccounts = await Promise.all(
//     receiverAddress.map((address) =>
//       context.UserAccount.get(
//         _key.userAccount({ chainId, address }) // assuming chainId 1 for consolidation
//       )
//     )
//   );

//   let pools: Record<string, BeamPool> = {};
//   let users: Record<number, User> = {};
//   let accounts: Record<string, UserAccount> = {};
//   let missingUsers: number[] = [];
//   let missingAccounts: {
//     address: string;
//     fid: number;
//   }[] = [];

//   poolResult.forEach((pool, index) => {
//     pools[consolidatedPoolAddress[index]] = pool;
//   });

//   potentialUsers.forEach((user, index) => {
//     if (user) {
//       users[user.fid] = user;
//     } else {
//       missingUsers.push(fids[index]);
//     }
//   });

//   potentialAccounts.forEach((account, index) => {
//     if (account) {
//       accounts[account.address] = account;
//     } else {
//       const order = rawOrders.find(
//         (order) => order.address === receiverAddress[index]
//       );
//       if (!order) {
//         context.log.error(
//           `Failed to find order for missing account with address: ${receiverAddress[index]}`
//         );
//         return;
//       }

//       missingAccounts.push({
//         address: order.address,
//         fid: order.receiverFid,
//       });
//     }
//   });
// };

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
  const fullRouting = event.params.members.map((member, index) => {
    return {
      poolAddress: poolAddresses[index],
      address: member[0],
      fidOutgo: fidRouting[index][0],
      fidInco: fidRouting[index][1],
      units: member[1],
    };
  });
  const allUniqueFIDs = [
    ...new Set(fullRouting.flatMap((tx) => [tx.fidInco, tx.fidOutgo])),
  ];
  const potentiallyExistingUsers = await Promise.all(
    allUniqueFIDs.map((fid) => context.User.get(_key.user({ fid })))
  );
  const potentiallyExistingBeams = await Promise.all(
    fullRouting.map((tx) =>
      context.Beam.get(
        _key.beam({
          poolAddress: tx.poolAddress,
          to: tx.address,
        })
      )
    )
  );
  const beamPools = (await Promise.all(
    fullRouting.map((tx) =>
      context.BeamPool.get(_key.beamPool({ poolAddress: tx.poolAddress }))
    )
  )) as BeamPool[];

  if (!beamPools.every((pool) => pool !== undefined)) {
    context.log.error(
      `One or more BeamPools not found on chainId: ${event.chainId} at tx ${event.transaction.hash}`
    );
    return;
  }

  potentiallyExistingUsers.forEach((user, index) => {
    if (!user) {
      const fid = allUniqueFIDs[index];
      context.User.set({
        id: _key.user({ fid }),
        fid,
      });
      // implicitly, the UserAccount must exist for this fid since it's in the routing
      // and any outgoing member must have an account + pool to cause this event
      const address = fullRouting.find((tx) => tx.fidInco === fid)?.address;

      if (address) {
        context.UserAccount.set({
          id: _key.userAccount({ chainId: event.chainId, address }),
          chainId: event.chainId,
          address,
          user_id: _key.user({ fid }),
        });
      }
    }
  });
  fullRouting.forEach((tx, index) => {
    const beam = potentiallyExistingBeams[index];
    const beamPool = beamPools[index];
    const allNewRecipientsOfPool = fullRouting
      .filter((t) => t.poolAddress === tx.poolAddress)
      .map((t) => t.address);
    if (!beam) {
      const newUnits =
        action === Action.Update
          ? tx.units
          : action === Action.Increase
            ? tx.units
            : 0n;
      if (action === Action.Decrease) {
        context.log.error(
          `Cannot decrease units for non-existing Beam for poolAddress: ${tx.poolAddress} and address: ${tx.address} on chainId: ${event.chainId} at tx ${event.transaction.hash}`
        );
        return;
      }
      context.Beam.set({
        id: _key.beam({
          poolAddress: tx.poolAddress,
          to: tx.address,
        }),
        chainId: event.chainId,
        from_id: _key.user({ fid: tx.fidOutgo }),
        to_id: _key.user({ fid: tx.fidInco }),
        beamPool_id: _key.beamPool({
          poolAddress: tx.poolAddress,
        }),
        recipientAccount_id: _key.userAccount({
          chainId: event.chainId,
          address: tx.address,
        }),
        units: newUnits,
        isReceiverConnected: false,
        lastUpdated: event.block.timestamp,
        beamR_id: _key.beamR({
          chainId: event.chainId,
          address: event.srcAddress,
        }),
      });
    } else {
      if (action === Action.Decrease && beam.units < tx.units) {
        context.log.error(
          `Cannot decrease more units than existing for Beam for poolAddress: ${tx.poolAddress} and address: ${tx.address} on chainId: ${event.chainId} at tx ${event.transaction.hash}`
        );
        return;
      }
      const newUnits =
        action === Action.Update
          ? tx.units
          : action === Action.Increase
            ? beam.units + tx.units
            : beam.units - tx.units;
      context.Beam.set({
        ...beam,
        units: newUnits,
        lastUpdated: event.block.timestamp,
      });
    }
    if (action === Action.Decrease && beamPool.totalUnits < tx.units) {
      context.log.error(
        `Cannot decrease more units than existing totalUnits for BeamPool for poolAddress: ${tx.poolAddress} on chainId: ${event.chainId} at tx ${event.transaction.hash}`
      );
      return;
    }
    context.BeamPool.set({
      ...beamPool,
      totalUnits:
        action === Action.Update
          ? beamPool.totalUnits -
            (potentiallyExistingBeams[index]?.units || 0n) +
            tx.units
          : action === Action.Increase
            ? beamPool.totalUnits + tx.units
            : beamPool.totalUnits - tx.units,
      lastUpdated: event.block.timestamp,
      // We fetched all recipients at the same time, including duplicates, so we need to reset final values here
      allRecipients: [beamPool.allRecipients, ...allNewRecipientsOfPool].flat(),
      beamCount: beamPool.beamCount + allNewRecipientsOfPool.length,
    });
  });

  context.TX.set(tx);
});
//
