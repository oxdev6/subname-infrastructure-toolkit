import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { ethers } from "ethers";
import { createApp } from "../src/app.js";
import { createIndexStore } from "../src/indexStore.js";

function mockRegistrar() {
  return {
    mintSubname: async () => ({
      wait: async () => ({ hash: "0xmint" })
    }),
    revokeSubname: async () => ({
      wait: async () => ({ hash: "0xrevoke" })
    }),
    getSubnameRecord: async () => [
      "0x000000000000000000000000000000000000dEaD",
      2000000000n,
      false,
      true
    ]
  };
}

test("creates and redeems claim link", async () => {
  const app = createApp({
    registrar: mockRegistrar(),
    rootDomain: "project.eth",
    claimSecret: "test-secret",
    indexStore: createIndexStore()
  });

  const createRes = await request(app)
    .post("/claim-links")
    .send({ label: "alice", expiresAt: Math.floor(Date.now() / 1000) + 3600, maxClaims: 1 })
    .expect(201);

  assert.ok(createRes.body.token);

  const wallet = ethers.Wallet.createRandom();
  const challengeRes = await request(app)
    .get("/claim-links/challenge")
    .query({ token: createRes.body.token, recipient: wallet.address })
    .expect(200);

  const redeemRes = await request(app)
    .post("/claim-links/redeem")
    .send({
      token: createRes.body.token,
      recipient: wallet.address,
      challengeNonce: challengeRes.body.challengeNonce,
      walletSignature: await wallet.signMessage(challengeRes.body.message)
    })
    .expect(201);

  assert.equal(redeemRes.body.success, true);
  assert.equal(redeemRes.body.fqdn, "alice.project.eth");

  const secondChallengeRes = await request(app)
    .get("/claim-links/challenge")
    .query({ token: createRes.body.token, recipient: wallet.address })
    .expect(409);

  assert.equal(secondChallengeRes.body.error, "claim already fully used");

  await request(app)
    .post("/claim-links/redeem")
    .send({
      token: createRes.body.token,
      recipient: wallet.address,
      challengeNonce: challengeRes.body.challengeNonce,
      walletSignature: await wallet.signMessage(challengeRes.body.message)
    })
    .expect(409);
});

test("rejects challenge nonce replay before claim is exhausted", async () => {
  const app = createApp({
    registrar: mockRegistrar(),
    rootDomain: "project.eth",
    claimSecret: "test-secret",
    indexStore: createIndexStore()
  });

  const createRes = await request(app)
    .post("/claim-links")
    .send({ label: "sam", expiresAt: Math.floor(Date.now() / 1000) + 3600, maxClaims: 2 })
    .expect(201);

  const wallet = ethers.Wallet.createRandom();
  const challengeRes = await request(app)
    .get("/claim-links/challenge")
    .query({ token: createRes.body.token, recipient: wallet.address })
    .expect(200);

  await request(app)
    .post("/claim-links/redeem")
    .send({
      token: createRes.body.token,
      recipient: wallet.address,
      challengeNonce: challengeRes.body.challengeNonce,
      walletSignature: await wallet.signMessage(challengeRes.body.message)
    })
    .expect(201);

  await request(app)
    .post("/claim-links/redeem")
    .send({
      token: createRes.body.token,
      recipient: wallet.address,
      challengeNonce: challengeRes.body.challengeNonce,
      walletSignature: await wallet.signMessage(challengeRes.body.message)
    })
    .expect(409);
});

test("rejects invalid wallet signature for claim redeem", async () => {
  const app = createApp({
    registrar: mockRegistrar(),
    rootDomain: "project.eth",
    claimSecret: "test-secret",
    indexStore: createIndexStore()
  });

  const createRes = await request(app)
    .post("/claim-links")
    .send({ label: "eve", expiresAt: Math.floor(Date.now() / 1000) + 3600, maxClaims: 1 })
    .expect(201);

  const recipient = ethers.Wallet.createRandom();
  const attacker = ethers.Wallet.createRandom();
  const challengeRes = await request(app)
    .get("/claim-links/challenge")
    .query({ token: createRes.body.token, recipient: recipient.address })
    .expect(200);

  await request(app)
    .post("/claim-links/redeem")
    .send({
      token: createRes.body.token,
      recipient: recipient.address,
      challengeNonce: challengeRes.body.challengeNonce,
      walletSignature: await attacker.signMessage(challengeRes.body.message)
    })
    .expect(401);
});

test("returns subname status", async () => {
  const app = createApp({
    registrar: mockRegistrar(),
    rootDomain: "project.eth",
    claimSecret: "test-secret",
    indexStore: createIndexStore()
  });

  const res = await request(app)
    .get("/subname-status")
    .query({ label: "alice" })
    .expect(200);

  assert.equal(res.body.active, true);
  assert.equal(res.body.fqdn, "alice.project.eth");
});

test("returns analytics and recent events", async () => {
  const app = createApp({
    registrar: mockRegistrar(),
    rootDomain: "project.eth",
    claimSecret: "test-secret",
    indexStore: createIndexStore()
  });

  await request(app)
    .post("/mint-subname")
    .send({
      label: "analytics-user",
      recipient: "0x000000000000000000000000000000000000bEEF",
      expiresAt: Math.floor(Date.now() / 1000) + 3600
    })
    .expect(201);

  const analytics = await request(app).get("/analytics").expect(200);
  assert.equal(analytics.body.totalSubnames, 1);
  assert.equal(analytics.body.activeSubnames, 1);
  assert.equal(analytics.body.uniqueHolders, 1);

  const events = await request(app).get("/events/recent").query({ limit: 5 }).expect(200);
  assert.equal(Array.isArray(events.body.events), true);
  assert.equal(events.body.events[0].type, "mint");
});

test("handles CORS preflight for allowed dashboard origin", async () => {
  const app = createApp({
    registrar: mockRegistrar(),
    rootDomain: "project.eth",
    claimSecret: "test-secret",
    indexStore: createIndexStore(),
    corsOrigins: ["http://localhost:3000"]
  });

  const preflight = await request(app)
    .options("/analytics")
    .set("Origin", "http://localhost:3000")
    .set("Access-Control-Request-Method", "GET")
    .expect(204);

  assert.equal(preflight.headers["access-control-allow-origin"], "http://localhost:3000");

  const get = await request(app)
    .get("/health")
    .set("Origin", "http://localhost:3000")
    .expect(200);

  assert.equal(get.headers["access-control-allow-origin"], "http://localhost:3000");
});

test("does not reflect disallowed origins in CORS headers", async () => {
  const app = createApp({
    registrar: mockRegistrar(),
    rootDomain: "project.eth",
    claimSecret: "test-secret",
    indexStore: createIndexStore(),
    corsOrigins: ["http://localhost:3000"]
  });

  const res = await request(app).get("/health").set("Origin", "https://evil.example").expect(200);

  assert.equal(res.headers["access-control-allow-origin"], undefined);
});
