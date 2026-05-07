import { registrar } from "./contract.js";
import { config } from "./config.js";
import { createApp } from "./app.js";
import { createIndexStore } from "./indexStore.js";
import { startIndexer } from "./indexer.js";

const rootDomain = await registrar.rootDomain();
const indexStore = createIndexStore();
const app = createApp({
  registrar,
  rootDomain,
  claimSecret: process.env.CLAIM_SECRET || "dev-secret",
  indexStore
});
startIndexer({ registrar, rootDomain, indexStore });

app.listen(config.port, () => {
  console.log(`Backend API listening on http://localhost:${config.port}`);
});
