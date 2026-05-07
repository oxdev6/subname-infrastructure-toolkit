import { registrar } from "./contract.js";
import { config } from "./config.js";
import { createApp } from "./app.js";

const rootDomain = await registrar.rootDomain();
const app = createApp({
  registrar,
  rootDomain,
  claimSecret: process.env.CLAIM_SECRET || "dev-secret"
});

app.listen(config.port, () => {
  console.log(`Backend API listening on http://localhost:${config.port}`);
});
