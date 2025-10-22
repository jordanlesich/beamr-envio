import { promises as fs } from 'fs';
import path from 'path';
import { Configuration, NeynarAPIClient } from '@neynar/nodejs-sdk';
import { experimental_createEffect, S } from 'envio';

//
const CACHE_PATH = path.resolve('../.envio/cache/getFcProfile.tsv');

type Profile = {
  display_name: string;
  username: string;
  pfp_url: string;
  ttl: number;
};

async function readCache(): Promise<Map<number, Profile>> {
  try {
    const data = await fs.readFile(CACHE_PATH, 'utf8');
    const lines = data.trim().split('\n').slice(1); // skip header
    const cache = new Map<number, Profile>();

    for (const line of lines) {
      const [fidStr, json] = line.split('\t');
      const fid = Number(fidStr);
      if (!Number.isNaN(fid) && json) {
        try {
          cache.set(fid, JSON.parse(json));
        } catch {}
      }
    }
    return cache;
  } catch {
    return new Map();
  }
}

async function writeCache(cache: Map<number, Profile>) {
  const header = 'id\toutput\n';
  const body = Array.from(cache.entries())
    .map(([id, profile]) => `${id}\t${JSON.stringify(profile)}`)
    .join('\n');
  await fs.writeFile(CACHE_PATH, header + body, 'utf8');
}

export const getFcProfile = experimental_createEffect(
  {
    name: 'getFcProfile',
    input: S.array(S.number),
    cache: false,
    output: S.array(
      S.schema({
        display_name: S.string,
        username: S.string,
        pfp_url: S.optional(S.string),
        ttl: S.number,
      })
    ),
  },
  async ({ input: fids, context }) => {
    if (!process.env.NEYNAR_API_KEY) {
      context.log.error('NEYNAR_API_KEY is not set');
      return [];
    }

    const config = new Configuration({ apiKey: process.env.NEYNAR_API_KEY });
    const client = new NeynarAPIClient(config);

    const cache = await readCache();
    const now = Date.now();

    const results: Profile[] = [];
    const missingFids: number[] = [];

    for (const fid of fids) {
      const cached = cache.get(fid);
      if (cached && cached.ttl > now) {
        results.push(cached);
      } else {
        missingFids.push(fid);
      }
    }

    if (missingFids.length > 0) {
      try {
        const response = await client.fetchBulkUsers({ fids: missingFids });
        for (const user of response.users || []) {
          const profile: Profile = {
            display_name: user.display_name || user.username,
            username: user.username,
            pfp_url: user.pfp_url || '',
            ttl: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
          };
          results.push(profile);
          cache.set(user.fid, profile);
        }
        await writeCache(cache);
      } catch (err) {
        context.log.error(`Neynar fetch failed: ${(err as Error).message}`);
      }
    }

    return results;
  }
);
