"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = require("node:assert/strict");
const git_url_1 = require("../src/git-url");
(0, node_test_1.test)('parses scp-like SSH remotes (git@host:group/repo.git)', () => {
    strict_1.default.deepEqual((0, git_url_1.gitUrlParser)('git@gitlab.com:group/repo.git'), {
        domain: 'gitlab.com',
        project: 'group/repo'
    });
});
(0, node_test_1.test)('parses https remotes and strips the trailing .git', () => {
    strict_1.default.deepEqual((0, git_url_1.gitUrlParser)('https://gitlab.com/group/subgroup/repo.git'), {
        domain: 'gitlab.com',
        project: 'group/subgroup/repo'
    });
});
(0, node_test_1.test)('parses https remotes without a .git suffix', () => {
    strict_1.default.deepEqual((0, git_url_1.gitUrlParser)('https://gitlab.example.com/group/repo'), {
        domain: 'gitlab.example.com',
        project: 'group/repo'
    });
});
(0, node_test_1.test)('parses ssh:// remotes with an explicit port (port dropped from domain)', () => {
    strict_1.default.deepEqual((0, git_url_1.gitUrlParser)('ssh://git@gitlab.example.com:2222/group/repo.git'), {
        domain: 'gitlab.example.com',
        project: 'group/repo'
    });
});
(0, node_test_1.test)('returns empty fields for an unparseable remote', () => {
    strict_1.default.deepEqual((0, git_url_1.gitUrlParser)(''), { domain: '', project: '' });
});
//# sourceMappingURL=git-url.test.js.map