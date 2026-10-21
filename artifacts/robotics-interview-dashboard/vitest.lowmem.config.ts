import base from "./vitest.config";

// Single-fork so the suite uses one worker instead of one per core. Used to
// run the suite on a memory-constrained machine.
export default {
  ...base,
  test: { ...base.test, pool: "forks", poolOptions: { forks: { singleFork: true } }, fileParallelism: false },
};
