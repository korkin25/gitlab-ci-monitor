"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = require("node:assert/strict");
const ansi_1 = require("../src/ansi");
(0, node_test_1.test)('strips CSI colour and erase-line sequences', () => {
    strict_1.default.equal((0, ansi_1.stripAnsi)('\x1B[0K\x1B[32;1mRunning build\x1B[0m\ndone\n'), 'Running build\ndone\n');
});
(0, node_test_1.test)('normalises CRLF and lone CR to LF', () => {
    strict_1.default.equal((0, ansi_1.stripAnsi)('a\r\nb\rc'), 'a\nb\nc');
});
(0, node_test_1.test)('removes GitLab section_start/section_end markers', () => {
    strict_1.default.equal((0, ansi_1.stripAnsi)('before\nsection_end:1600000123:step_script\nafter\n'), 'before\n\nafter\n');
});
(0, node_test_1.test)('strips OSC sequences', () => {
    strict_1.default.equal((0, ansi_1.stripAnsi)('\x1B]0;title\x07text'), 'text');
});
(0, node_test_1.test)('leaves clean text untouched', () => {
    strict_1.default.equal((0, ansi_1.stripAnsi)('plain log line\n'), 'plain log line\n');
});
//# sourceMappingURL=ansi.test.js.map