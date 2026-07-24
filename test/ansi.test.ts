import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripAnsi } from '../src/ansi';

test('strips CSI colour and erase-line sequences', () => {
	assert.equal(stripAnsi('\x1B[0K\x1B[32;1mRunning build\x1B[0m\ndone\n'), 'Running build\ndone\n');
});

test('normalises CRLF and lone CR to LF', () => {
	assert.equal(stripAnsi('a\r\nb\rc'), 'a\nb\nc');
});

test('removes GitLab section_start/section_end markers', () => {
	assert.equal(stripAnsi('before\nsection_end:1600000123:step_script\nafter\n'), 'before\n\nafter\n');
});

test('strips OSC sequences', () => {
	assert.equal(stripAnsi('\x1B]0;title\x07text'), 'text');
});

test('leaves clean text untouched', () => {
	assert.equal(stripAnsi('plain log line\n'), 'plain log line\n');
});
