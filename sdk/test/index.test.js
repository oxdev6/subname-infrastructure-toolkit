import test from "node:test";
import assert from "node:assert/strict";
import { EnsSubnameToolkit } from "../src/index.js";

function createFetchMock(routes) {
  return async (url, options = {}) => {
    const key = `${options.method || "GET"} ${url}`;
    const route = routes.get(key);
    if (!route) {
      return {
        ok: false,
        status: 404,
        json: async () => ({ error: `route not mocked: ${key}` })
      };
    }
    return {
      ok: route.ok ?? true,
      status: route.status ?? 200,
      json: async () => route.body
    };
  };
}

test("createSubname posts payload and returns response", async () => {
  const routes = new Map();
  routes.set("POST http://api.local/mint-subname", {
    body: { success: true, fqdn: "alice.project.eth" }
  });
  const client = new EnsSubnameToolkit({
    apiBaseUrl: "http://api.local",
    fetchImpl: createFetchMock(routes)
  });

  const result = await client.createSubname("alice", "0xabc", 2000000000);
  assert.equal(result.success, true);
  assert.equal(result.fqdn, "alice.project.eth");
});

test("resolveSubname supports fqdn input", async () => {
  const routes = new Map();
  routes.set("GET http://api.local/subname-status?label=alice", {
    body: { label: "alice", active: true }
  });
  const client = new EnsSubnameToolkit({
    apiBaseUrl: "http://api.local",
    fetchImpl: createFetchMock(routes)
  });

  const result = await client.resolveSubname("alice.project.eth");
  assert.equal(result.active, true);
});

test("throws with backend error message", async () => {
  const routes = new Map();
  routes.set("GET http://api.local/analytics", {
    ok: false,
    status: 500,
    body: { error: "backend unavailable" }
  });
  const client = new EnsSubnameToolkit({
    apiBaseUrl: "http://api.local",
    fetchImpl: createFetchMock(routes)
  });

  await assert.rejects(() => client.getAnalytics(), /backend unavailable/);
});
