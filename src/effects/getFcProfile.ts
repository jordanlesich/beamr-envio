import { Configuration, NeynarAPIClient } from '@neynar/nodejs-sdk';
import { experimental_createEffect, S } from 'envio';

export const getFcProfiles = experimental_createEffect(
  {
    name: 'getFcProfiles',
    input: S.number,
    output: S.optional(
      S.schema({
        display_name: S.string,
        username: S.string,
        pfp_url: S.optional(S.string),
      })
    ),
  },
  async ({ input, context }) => {
    if (!process.env.NEYNAR_API_KEY) {
      context.log.error('NEYNAR_API_KEY is not set');
      return;
    }
    const config = new Configuration({
      apiKey: process.env.NEYNAR_API_KEY,
    });
    const client = new NeynarAPIClient(config);

    const response = await client.fetchBulkUsers({
      fids: [input],
    });

    const user = response?.users?.[0];

    if (!user) {
      context.log.error(`User with fid ${input} not found`);
      return;
    }

    return {
      display_name: user.display_name || user.username,
      username: user.username,
      pfp_url: user.pfp_url || '',
    };
  }
);
