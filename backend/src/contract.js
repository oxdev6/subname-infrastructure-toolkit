import { ethers } from "ethers";
import { config } from "./config.js";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const artifactPath = fileURLToPath(
  new URL("../../contracts/artifacts/contracts/SubnameRegistrar.sol/SubnameRegistrar.json", import.meta.url)
);

if (!fs.existsSync(artifactPath)) {
  throw new Error("Contract artifact not found. Run contract compile/tests first.");
}

const artifactRaw = fs.readFileSync(artifactPath, "utf8");
const artifact = JSON.parse(artifactRaw);

const provider = new ethers.JsonRpcProvider(config.rpcUrl);
const wallet = new ethers.Wallet(config.privateKey, provider);

export const registrar = new ethers.Contract(config.registrarAddress, artifact.abi, wallet);
