import * as fs from "node:fs/promises";
import { randomUUID } from "node:crypto";

// Serialize ID allocation, validation and writes together, not just individual renames.
export function createQueue() {
  let tail = Promise.resolve();
  return (operation) => {
    const result = tail.then(operation);
    tail = result.catch(() => {});
    return result;
  };
}

// Each replacement is atomic; if a later operation fails, restore prior files.
// This protects against I/O errors, but is not a crash-safe database transaction.
export async function writeTransaction(changes, io = fs) {
  const token = randomUUID();
  const staged = [];
  const committed = [];
  let rollbackFailed = false;
  try {
    for (const change of changes) {
      const before = await io.readFile(change.path).catch((error) => {
        if (error.code === "ENOENT") return null;
        throw error;
      });
      const entry = { ...change, before, temp: `${change.path}.${token}.tmp` };
      staged.push(entry);
      if (entry.content !== null) await io.writeFile(entry.temp, entry.content, { flag: "wx" });
    }
    for (const entry of staged) {
      if (entry.content === null) {
        if (entry.before !== null) await io.unlink(entry.path);
      } else await io.rename(entry.temp, entry.path);
      committed.push(entry);
    }
  } catch (error) {
    const failures = [error];
    for (const entry of committed.reverse()) {
      try {
        if (entry.before === null) await io.unlink(entry.path);
        else {
          await io.writeFile(entry.temp, entry.before);
          await io.rename(entry.temp, entry.path);
        }
      } catch (rollbackError) { rollbackFailed = true; failures.push(rollbackError); }
    }
    if (failures.length > 1) throw new AggregateError(failures, "保存失败且回滚未完成，请检查文件后重试");
    throw error;
  } finally {
    // If recovery itself failed, keep any restoration files for manual recovery.
    if (!rollbackFailed) await Promise.all(staged.map((entry) => io.unlink(entry.temp).catch(() => {})));
  }
}
