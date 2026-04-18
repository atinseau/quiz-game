import { networkInterfaces } from "node:os";

function getLanIp(): string {
  for (const iface of Object.values(networkInterfaces())) {
    for (const info of iface ?? []) {
      if (info.family === "IPv4" && !info.internal) return info.address;
    }
  }
  return "localhost";
}

const envPath = new URL("../.env", import.meta.url);
const file = Bun.file(envPath);
const content = (await file.exists()) ? await file.text() : "";
const ip = getLanIp();
const line = `HOSTNAME=${ip}`;

const next = /^HOSTNAME=.*$/m.test(content)
  ? content.replace(/^HOSTNAME=.*$/m, line)
  : `${line}\n${content}`;

if (next !== content) await Bun.write(envPath, next);
console.log(`HOSTNAME=${ip}`);
