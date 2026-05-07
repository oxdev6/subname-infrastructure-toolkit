import dotenv from "dotenv";

dotenv.config();

function required(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT || 4000),
  rpcUrl: required("RPC_URL"),
  privateKey: required("PRIVATE_KEY"),
  registrarAddress: required("REGISTRAR_ADDRESS")
};
