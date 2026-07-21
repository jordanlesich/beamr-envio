import { indexer, SuperfluidPool } from "envio";
import { _key } from './utils/sync';

indexer.onEvent(
  { contract: "SuperfluidPool", event: "MemberUnitsUpdated" },
  async ({ event, context }) => {}
);
