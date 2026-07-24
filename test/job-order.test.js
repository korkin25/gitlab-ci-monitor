"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = require("node:assert/strict");
const job_order_1 = require("../src/job-order");
(0, node_test_1.test)('keeps only the latest job per name (highest id wins)', () => {
    const jobs = [
        { id: 20, name: 'unit', stage: 'test', status: 'failed' },
        { id: 21, name: 'unit', stage: 'test', status: 'success' }
    ];
    const out = (0, job_order_1.orderJobs)(jobs);
    strict_1.default.equal(out.length, 1);
    strict_1.default.equal(out[0].id, 21);
});
(0, node_test_1.test)('skips canceled jobs entirely', () => {
    const jobs = [
        { id: 30, name: 'deploy', stage: 'deploy', status: 'canceled' },
        { id: 31, name: 'build', stage: 'build', status: 'success' }
    ];
    const out = (0, job_order_1.orderJobs)(jobs);
    strict_1.default.deepEqual(out.map((j) => j.name), ['build']);
});
(0, node_test_1.test)('orders by first-seen stage, then by job id — stage order beats id', () => {
    const jobs = [
        { id: 10, name: 'compile', stage: 'build', status: 'success' },
        { id: 11, name: 'lint', stage: 'build', status: 'success' },
        { id: 21, name: 'unit', stage: 'test', status: 'success' },
        { id: 5, name: 'deploy', stage: 'deploy', status: 'manual' }
    ];
    const out = (0, job_order_1.orderJobs)(jobs);
    strict_1.default.deepEqual(out.map((j) => j.name), ['compile', 'lint', 'unit', 'deploy']);
});
//# sourceMappingURL=job-order.test.js.map