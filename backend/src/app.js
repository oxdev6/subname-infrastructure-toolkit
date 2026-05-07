import express from "express";
import crypto from "node:crypto";
import { ethers } from "ethers";
import { createIndexStore } from "./indexStore.js";

function claimToken() {
  return crypto.randomBytes(18).toString("base64url");
}

export function createApp({ registrar, rootDomain, claimSecret = "dev-secret", indexStore = createIndexStore() }) {
  const app = express();
  app.use(express.json());

  const claims = new Map();
  const challenges = new Map();
  const challengeTtlSeconds = 300;

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.post("/mint-subname", async (req, res) => {
    try {
      const { label, recipient, expiresAt } = req.body;
      if (!label || !recipient || !expiresAt) {
        return res.status(400).json({ error: "label, recipient, and expiresAt are required" });
      }

      const tx = await registrar.mintSubname(label, recipient, Number(expiresAt));
      const receipt = await tx.wait();
      indexStore.applyMint({
        label,
        fqdn: `${label}.${rootDomain}`,
        owner: recipient,
        expiresAt: Number(expiresAt),
        txHash: receipt.hash
      });

      return res.status(201).json({
        success: true,
        txHash: receipt.hash,
        label,
        fqdn: `${label}.${rootDomain}`
      });
    } catch (error) {
      return res.status(500).json({ error: error?.shortMessage || error?.message || "mint failed" });
    }
  });

  app.post("/revoke-subname", async (req, res) => {
    try {
      const { label } = req.body;
      if (!label) {
        return res.status(400).json({ error: "label is required" });
      }

      const tx = await registrar.revokeSubname(label);
      const receipt = await tx.wait();
      indexStore.applyRevoke({
        label,
        txHash: receipt.hash
      });

      return res.json({
        success: true,
        txHash: receipt.hash,
        label
      });
    } catch (error) {
      return res.status(500).json({ error: error?.shortMessage || error?.message || "revoke failed" });
    }
  });

  app.get("/subname-status", async (req, res) => {
    try {
      const label = String(req.query.label || "");
      if (!label) {
        return res.status(400).json({ error: "label query parameter is required" });
      }

      const [owner, expiresAt, revoked, active] = await registrar.getSubnameRecord(label);
      indexStore.applyStatus({
        label,
        fqdn: `${label}.${rootDomain}`,
        owner,
        expiresAt,
        revoked,
        active
      });

      return res.json({
        label,
        fqdn: `${label}.${rootDomain}`,
        owner,
        expiresAt: Number(expiresAt),
        revoked,
        active
      });
    } catch (error) {
      return res.status(500).json({ error: error?.shortMessage || error?.message || "status failed" });
    }
  });

  app.post("/claim-links", async (req, res) => {
    const { label, expiresAt, maxClaims = 1 } = req.body;
    if (!label || !expiresAt) {
      return res.status(400).json({ error: "label and expiresAt are required" });
    }
    if (Number(expiresAt) <= Math.floor(Date.now() / 1000)) {
      return res.status(400).json({ error: "expiresAt must be in the future" });
    }

    const token = claimToken();
    const payload = `${token}:${label}:${expiresAt}:${maxClaims}`;
    const signature = crypto.createHmac("sha256", claimSecret).update(payload).digest("hex");

    claims.set(token, {
      label,
      expiresAt: Number(expiresAt),
      maxClaims: Number(maxClaims),
      claimsUsed: 0,
      signature
    });

    return res.status(201).json({
      token,
      claimUrl: `/claim/${token}`,
      label,
      expiresAt: Number(expiresAt),
      maxClaims: Number(maxClaims)
    });
  });

  app.post("/claim-links/redeem", async (req, res) => {
    try {
      const { token, recipient, challengeNonce, walletSignature } = req.body;
      if (!token || !recipient || !challengeNonce || !walletSignature) {
        return res
          .status(400)
          .json({ error: "token, recipient, challengeNonce, and walletSignature are required" });
      }

      const claim = claims.get(token);
      if (!claim) {
        return res.status(404).json({ error: "claim not found" });
      }
      if (claim.claimsUsed >= claim.maxClaims) {
        return res.status(409).json({ error: "claim already fully used" });
      }
      if (claim.expiresAt <= Math.floor(Date.now() / 1000)) {
        return res.status(410).json({ error: "claim expired" });
      }

      const payload = `${token}:${claim.label}:${claim.expiresAt}:${claim.maxClaims}`;
      const expectedSignature = crypto.createHmac("sha256", claimSecret).update(payload).digest("hex");
      if (expectedSignature !== claim.signature) {
        return res.status(400).json({ error: "claim integrity check failed" });
      }

      const challengeKey = `${token}:${String(recipient).toLowerCase()}:${challengeNonce}`;
      const challenge = challenges.get(challengeKey);
      if (!challenge) {
        return res.status(400).json({ error: "challenge not found" });
      }
      if (challenge.used) {
        return res.status(409).json({ error: "challenge already used" });
      }
      if (challenge.expiresAt <= Math.floor(Date.now() / 1000)) {
        return res.status(410).json({ error: "challenge expired" });
      }

      const challengeMessage = `ENS Subname Claim
Domain:${rootDomain}
Token:${token}
Recipient:${recipient}
Label:${claim.label}
ExpiresAt:${claim.expiresAt}
Nonce:${challengeNonce}`;
      const recovered = ethers.verifyMessage(challengeMessage, walletSignature);
      if (recovered.toLowerCase() !== String(recipient).toLowerCase()) {
        return res.status(401).json({ error: "wallet signature does not match recipient" });
      }
      challenge.used = true;

      const tx = await registrar.mintSubname(claim.label, recipient, claim.expiresAt);
      const receipt = await tx.wait();
      claim.claimsUsed += 1;

      return res.status(201).json({
        success: true,
        txHash: receipt.hash,
        fqdn: `${claim.label}.${rootDomain}`,
        claimsUsed: claim.claimsUsed,
        maxClaims: claim.maxClaims
      });
    } catch (error) {
      return res.status(500).json({ error: error?.shortMessage || error?.message || "claim redemption failed" });
    }
  });

  app.get("/claim-links/challenge", (req, res) => {
    const token = String(req.query.token || "");
    const recipient = String(req.query.recipient || "");
    if (!token || !recipient) {
      return res.status(400).json({ error: "token and recipient query parameters are required" });
    }

    const claim = claims.get(token);
    if (!claim) {
      return res.status(404).json({ error: "claim not found" });
    }
    if (claim.claimsUsed >= claim.maxClaims) {
      return res.status(409).json({ error: "claim already fully used" });
    }
    if (claim.expiresAt <= Math.floor(Date.now() / 1000)) {
      return res.status(410).json({ error: "claim expired" });
    }

    const nonce = claimToken();
    const now = Math.floor(Date.now() / 1000);
    const challengeExpiresAt = Math.min(claim.expiresAt, now + challengeTtlSeconds);
    const challengeKey = `${token}:${recipient.toLowerCase()}:${nonce}`;
    challenges.set(challengeKey, {
      used: false,
      expiresAt: challengeExpiresAt
    });

    const message = `ENS Subname Claim
Domain:${rootDomain}
Token:${token}
Recipient:${recipient}
Label:${claim.label}
ExpiresAt:${claim.expiresAt}
Nonce:${nonce}`;
    return res.json({
      token,
      recipient,
      label: claim.label,
      expiresAt: claim.expiresAt,
      challengeNonce: nonce,
      challengeExpiresAt,
      message
    });
  });

  app.get("/analytics", (_req, res) => {
    return res.json(indexStore.getAnalytics());
  });

  app.get("/events/recent", (req, res) => {
    const limit = Number(req.query.limit || 25);
    return res.json({ events: indexStore.getRecentEvents(limit) });
  });

  return app;
}
