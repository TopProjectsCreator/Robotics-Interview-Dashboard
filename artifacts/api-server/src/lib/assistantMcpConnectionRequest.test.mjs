import assert from "node:assert/strict";
import test from "node:test";

import {
  assistantMcpConnectionRequestEnabled,
  parseAssistantMcpConnectionRequest,
} from "./assistantMcpConnectionRequest.ts";

test("accepts a well-formed HTTPS endpoint as a proposal without probing it", () => {
  assert.deepEqual(parseAssistantMcpConnectionRequest('{"endpointUrl":" https://tools.example/mcp "}'), {
    ok: true,
    request: { type: "custom_mcp_connection", endpointUrl: "https://tools.example/mcp" },
  });
});

test("rejects malformed, unsafe-syntax, and extra proposal arguments", () => {
  assert.equal(parseAssistantMcpConnectionRequest("{").ok, false);
  assert.equal(parseAssistantMcpConnectionRequest('{"endpointUrl":"http://tools.example/mcp"}').ok, false);
  assert.equal(parseAssistantMcpConnectionRequest('{"endpointUrl":"https://user:pass@tools.example/mcp"}').ok, false);
  assert.equal(parseAssistantMcpConnectionRequest('{"endpointUrl":"https://tools.example/mcp#fragment"}').ok, false);
  assert.equal(parseAssistantMcpConnectionRequest('{"endpointUrl":"https://tools.example/mcp","apiKey":"secret"}').ok, false);
  assert.equal(parseAssistantMcpConnectionRequest(JSON.stringify({ endpointUrl: `https://${"a".repeat(2049)}.example/mcp` })).ok, false);
});

test("does not resolve hostnames while parsing a connection proposal", () => {
  const request = parseAssistantMcpConnectionRequest('{"endpointUrl":"https://127.0.0.1/mcp"}');
  assert.equal(request.ok, true);
});

test("connection requests stay disabled for members, Parts, disabled tools, and disallowed skills", () => {
  const coordinator = { coordinator: true, partsMode: false, disabled: false, skillAllowed: true };
  assert.equal(assistantMcpConnectionRequestEnabled(coordinator), true);
  assert.equal(assistantMcpConnectionRequestEnabled({ ...coordinator, coordinator: false }), false);
  assert.equal(assistantMcpConnectionRequestEnabled({ ...coordinator, partsMode: true }), false);
  assert.equal(assistantMcpConnectionRequestEnabled({ ...coordinator, disabled: true }), false);
  assert.equal(assistantMcpConnectionRequestEnabled({ ...coordinator, skillAllowed: false }), false);
});
