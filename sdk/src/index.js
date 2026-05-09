function assert(value, message) {
  if (!value) {
    throw new Error(message);
  }
}

async function parseResponse(response) {
  let body = null;
  try {
    body = await response.json();
  } catch (_error) {
    body = null;
  }

  if (!response.ok) {
    throw new Error(body?.error || `Request failed with status ${response.status}`);
  }
  return body;
}

export class EnsSubnameToolkit {
  constructor({ apiBaseUrl, fetchImpl = fetch }) {
    assert(apiBaseUrl, "apiBaseUrl is required");
    this.apiBaseUrl = apiBaseUrl.replace(/\/+$/, "");
    this.fetch = fetchImpl;
  }

  async createSubname(label, recipient, expiresAt) {
    assert(label, "label is required");
    assert(recipient, "recipient is required");
    assert(expiresAt, "expiresAt is required");

    const response = await this.fetch(`${this.apiBaseUrl}/mint-subname`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label, recipient, expiresAt })
    });
    return parseResponse(response);
  }

  async revokeSubname(label) {
    assert(label, "label is required");
    const response = await this.fetch(`${this.apiBaseUrl}/revoke-subname`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label })
    });
    return parseResponse(response);
  }

  async resolveSubname(fqdnOrLabel) {
    assert(fqdnOrLabel, "fqdnOrLabel is required");
    const label = fqdnOrLabel.includes(".") ? fqdnOrLabel.split(".")[0] : fqdnOrLabel;
    const response = await this.fetch(`${this.apiBaseUrl}/subname-status?label=${encodeURIComponent(label)}`);
    return parseResponse(response);
  }

  async getSubnameStatus(label) {
    return this.resolveSubname(label);
  }

  async createClaimLink(label, expiresAt, maxClaims = 1) {
    assert(label, "label is required");
    assert(expiresAt, "expiresAt is required");
    const response = await this.fetch(`${this.apiBaseUrl}/claim-links`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label, expiresAt, maxClaims })
    });
    return parseResponse(response);
  }

  async getClaimChallenge(token, recipient) {
    assert(token, "token is required");
    assert(recipient, "recipient is required");
    const query = `token=${encodeURIComponent(token)}&recipient=${encodeURIComponent(recipient)}`;
    const response = await this.fetch(`${this.apiBaseUrl}/claim-links/challenge?${query}`);
    return parseResponse(response);
  }

  async redeemClaim(token, recipient, challengeNonce, walletSignature) {
    assert(token, "token is required");
    assert(recipient, "recipient is required");
    assert(challengeNonce, "challengeNonce is required");
    assert(walletSignature, "walletSignature is required");
    const response = await this.fetch(`${this.apiBaseUrl}/claim-links/redeem`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, recipient, challengeNonce, walletSignature })
    });
    return parseResponse(response);
  }

  async getAnalytics() {
    const response = await this.fetch(`${this.apiBaseUrl}/analytics`);
    return parseResponse(response);
  }

  async getRecentEvents(limit = 25) {
    const response = await this.fetch(`${this.apiBaseUrl}/events/recent?limit=${Number(limit)}`);
    return parseResponse(response);
  }
}

export function createClient(config) {
  return new EnsSubnameToolkit(config);
}
