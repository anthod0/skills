import assert from "node:assert/strict";
import test from "node:test";
import { listHosts, updateConfig } from "../src/config.js";

const homeNetwork = `# Home network
Host nas
  HostName 192.168.1.20
  User sam
  IdentityFile "~/.ssh/home key"
  LocalForward 8080 localhost:80

# Keep connections alive over the VPN.
Host *
  ServerAliveInterval 30
`;

test("lists local aliases without treating defaults or Match sections as hosts", () => {
  const entries = listHosts(homeNetwork + "\nMatch user deploy\n  Port 2222\n");
  assert.deepEqual(Object.keys(entries[0]), ["alias", "host", "user", "identity"]);
  assert.deepEqual(entries, [
    {
      alias: "nas",
      host: "192.168.1.20",
      user: "sam",
      identity: "~/.ssh/home key",
    },
  ]);
});

test("changes the destination without rewriting comments, forwarding or defaults", () => {
  const updated = updateConfig(homeNetwork, {
    kind: "set",
    alias: "nas",
    options: { host: "192.168.1.21" },
  });
  assert.ok(updated);
  assert.equal(updated, homeNetwork.replace("192.168.1.20", "192.168.1.21"));
});

test("adds a host before wildcard defaults so its options take precedence", () => {
  const source = homeNetwork + "  User guest\n";
  const updated = updateConfig(source, {
    kind: "add",
    alias: "devbox",
    options: { host: "10.8.0.14", user: "deploy", port: "2222" },
  });
  assert.deepEqual(
    listHosts(updated).find((host) => host.alias === "devbox"),
    {
      alias: "devbox",
      host: "10.8.0.14",
      user: "deploy",
      port: "2222",
    },
  );
  assert.ok(updated.indexOf("Host devbox") < updated.indexOf("Host *"));
  assert.ok(updated.endsWith("Host *\n  ServerAliveInterval 30\n  User guest\n"));
});

test("updates equals syntax and retains inline comments and CRLF endings", () => {
  const source = "Host nas\r\n\tPort=22 # forwarded by the router\r\n";
  const updated = updateConfig(source, { kind: "set", alias: "nas", options: { port: "2222" } });
  assert.equal(listHosts(updated)[0].port, "2222");
  assert.ok(updated.includes("# forwarded by the router\r\n"));
  assert.doesNotMatch(updated, /(?<!\r)\n/);
});

test("rename and removal leave other hosts and their comments alone", () => {
  const neighbour = "\n# Offsite backup\nHost backup\n  HostName 10.0.0.9\n";
  const source = "Host nas\n  HostName 192.168.1.20\n" + neighbour;
  const renamed = updateConfig(source, { kind: "rename", alias: "nas", to: "storage" });
  assert.deepEqual(
    listHosts(renamed).map((host) => host.alias),
    ["storage", "backup"],
  );
  assert.ok(renamed.endsWith(neighbour));
  assert.equal(updateConfig(renamed, { kind: "remove", alias: "storage" }), neighbour);
});

test("rejects collisions and ambiguous targets rather than choosing a block", () => {
  assert.throws(() =>
    updateConfig(homeNetwork, {
      kind: "add",
      alias: "NAS",
      options: { host: "10.0.0.1" },
    }),
  );
  for (const source of [
    "Host nas storage\n  User sam\n",
    "Host nas\n  User sam\nHost nas\n  Port 2222\n",
    "Include conf.d/*\nHost nas\n  User sam\n",
    "Host nas\n  User sam\nMatch all\n  Port 2222\n",
  ]) {
    assert.throws(() => updateConfig(source, { kind: "remove", alias: "nas" }));
  }
});

test("rejects out-of-range ports and values that could insert extra directives", () => {
  assert.throws(
    () => updateConfig(homeNetwork, { kind: "set", alias: "nas", options: { port: "0" } }),
    { message: "Port must be an integer from 1 to 65535." },
  );
  for (const options of [
    { port: "0" },
    { port: "65536" },
    { port: "22.5" },
    { host: "server\n  ProxyCommand unexpected" },
    { identity: 'key"\n  User root' },
  ]) {
    assert.throws(() => updateConfig(homeNetwork, { kind: "set", alias: "nas", options }));
  }
  for (const port of ["1", "65535"]) {
    let updated = "";
    assert.doesNotThrow(() => {
      updated = updateConfig(homeNetwork, {
        kind: "set",
        alias: "nas",
        options: { port },
      });
    });
    assert.equal(listHosts(updated)[0].port, port);
  }
});
