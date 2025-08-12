import { isAddress } from 'viem';
import z from 'zod';

export const ONCHAIN_EVENT = 6969420n;

export enum PoolType {
  Unknown,
  Tip,
  Earn,
}

export const poolMetadataSchema = z.object({
  creatorFID: z.number().int(),
  poolType: z.enum(PoolType),
  name: z.string().min(1, 'Pool name must be at least 1 character long'),
  description: z
    .string()
    .min(1, 'Pool description must be at least 1 character long')
    .nullable(),
  castHash: z.string().nullable(),
  instructions: z.string().nullable(),
});
