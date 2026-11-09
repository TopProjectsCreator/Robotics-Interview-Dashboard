import test from "node:test";
import assert from "node:assert/strict";
import { mock } from "node:test";
import { hasPermission, normalizePermissions, permissionsForBuiltInRole } from "../../../../lib/api-zod/src/permissions.ts";

mock.module("@workspace/api-zod", { namedExports: { hasPermission } });

const { permissionForRoute, permissionIsGranted, routePermissionIsGranted } = await import("./routePermissions.ts");

test("route policy separates read, ordinary writes, and management actions", () => {
  assert.equal(permissionForRoute("GET", "/api/applicants"), "applicants.view");
  assert.equal(permissionForRoute("PATCH", "/api/applicants/abc"), "applicants.edit");
  assert.equal(permissionForRoute("POST", "/api/applicants/abc/regenerate"), "applicants.manage");
  assert.equal(permissionForRoute("GET", "/api/parts/catalog"), "parts.view");
  assert.equal(permissionForRoute("PATCH", "/api/parts/catalog/abc/stock"), "parts.edit");
  assert.equal(permissionForRoute("DELETE", "/api/cad/models/abc"), "cad.manage");
  assert.equal(permissionForRoute("PUT", "/api/code/files/abc"), "code.edit");
  assert.equal(permissionForRoute("POST", "/api/queue/chat"), "chat.send");
  assert.equal(permissionForRoute("POST", "/api/queue/chat/abc/pin"), "chat.moderate");
  assert.equal(permissionForRoute("POST", "/api/queue/chat/channels"), "chat.manage");
  assert.equal(routePermissionIsGranted(["chat.manage"], "POST", "/api/queue/chat/channels"), true);
  assert.equal(routePermissionIsGranted(["chat.send"], "POST", "/api/queue/chat/channels"), false);
});

test("unknown routes and unrecognized permissions deny access", () => {
  assert.equal(permissionForRoute("GET", "/api/not-in-the-catalog"), null);
  assert.equal(permissionIsGranted(["applicants.view", "future.permission"], null), false);
  assert.equal(hasPermission(["future.permission"], "applicants.view"), false);
  assert.deepEqual(normalizePermissions(["applicants.view", "future.permission"]), ["applicants.view"]);
});

test("built-in role defaults preserve the three supported role tiers", () => {
  const admin = permissionsForBuiltInRole("coordinator");
  const treasurer = permissionsForBuiltInRole("treasurer");
  const interviewer = permissionsForBuiltInRole("interviewer");
  assert.ok(admin.includes("team.mailbox.manage"));
  assert.ok(treasurer.includes("applicants.view"));
  assert.ok(!treasurer.includes("applicants.edit"));
  assert.ok(interviewer.includes("chat.send"));
  assert.ok(!interviewer.includes("applicants.view"));
  assert.deepEqual(permissionsForBuiltInRole("unknown-role"), []);
});

test("management capabilities include their corresponding read and edit access", () => {
  assert.equal(hasPermission(["parts.manage"], "parts.view"), true);
  assert.equal(hasPermission(["parts.manage"], "parts.edit"), true);
  assert.equal(hasPermission(["customWorkspaces.manage"], "customWorkspaces.view"), true);
  assert.equal(hasPermission(["parts.view"], "parts.manage"), false);
});

test("generic object reads and writes require an applicable workspace capability", () => {
  assert.equal(routePermissionIsGranted(["cad.view"], "GET", "/api/storage/objects/model-id"), true);
  assert.equal(routePermissionIsGranted(["chat.view"], "GET", "/api/storage/objects/model-id"), true);
  assert.equal(routePermissionIsGranted(["cad.view"], "DELETE", "/api/storage/objects/model-id"), false);
  assert.equal(routePermissionIsGranted(["cad.edit"], "DELETE", "/api/storage/objects/model-id"), true);
  assert.equal(routePermissionIsGranted([], "GET", "/api/storage/objects/model-id"), false);
  assert.equal(routePermissionIsGranted(["cad.edit"], "POST", "/api/storage/uploads/chunk-url"), true);
  assert.equal(routePermissionIsGranted(["chat.view"], "POST", "/api/storage/uploads/chunk-url"), false);
  assert.equal(routePermissionIsGranted(["code.view"], "GET", "/api/workspaces/visibility"), true);
  assert.equal(routePermissionIsGranted([], "GET", "/api/workspaces/visibility"), false);
});

test("applicant updates require all permissions for mixed queue and attendance fields", () => {
  assert.equal(routePermissionIsGranted(["applicants.edit"], "PATCH", "/api/applicants/abc", { name: "New name" }), true);
  assert.equal(routePermissionIsGranted(["applicants.edit"], "PATCH", "/api/applicants/abc", { attendance: "present" }), false);
  assert.equal(routePermissionIsGranted(["attendance.manage"], "PATCH", "/api/applicants/abc", { attendance: "present" }), true);
  assert.equal(routePermissionIsGranted(
    ["applicants.edit", "attendance.manage"],
    "PATCH",
    "/api/applicants/abc",
    { name: "New name", attendance: "present" },
  ), true);
});
