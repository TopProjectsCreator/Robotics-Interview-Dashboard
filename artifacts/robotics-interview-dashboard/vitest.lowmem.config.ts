import base from "./vitest.config";

// One worker, one test file at a time, so the suite uses a single forked
// worker instead of one per core. Used to run the suite on a
// memory-constrained machine.
//
// Each file still runs in its own fork, so the files stay isolated from
// each other. Do not turn this into a single fork: sharing one process
// leaks module state between files and fails tests that pass in the
// normal configuration.
export default {
  ...base,
  test: {
    ...base.test,
    pool: "forks",
    poolOptions: { forks: { maxForks: 1, minForks: 1 } },
    fileParallelism: false,
  },
};
