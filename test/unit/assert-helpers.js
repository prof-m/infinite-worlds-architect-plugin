/**
 * Custom assertion helpers for node:test
 * Provides an expect-like API using node:assert
 */

import assert from 'node:assert';

export function createExpect(actual) {
  return {
    toBe(expected) {
      assert.strictEqual(actual, expected);
    },
    toEqual(expected) {
      assert.deepStrictEqual(actual, expected);
    },
    toContain(value) {
      if (Array.isArray(actual)) {
        assert(actual.includes(value), `Expected array to contain ${value}`);
      } else if (typeof actual === 'string') {
        assert(actual.includes(value), `Expected string to contain "${value}"`);
      } else {
        throw new Error('toContain only works with arrays or strings');
      }
    },
    toMatch(pattern) {
      assert(pattern.test(actual), `Expected ${actual} to match ${pattern}`);
    },
    toBeTruthy() {
      assert(!!actual, `Expected ${actual} to be truthy`);
    },
    toBeFalsy() {
      assert(!actual, `Expected ${actual} to be falsy`);
    },
    toBeDefined() {
      assert(actual !== undefined, 'Expected value to be defined');
    },
    toBeUndefined() {
      assert(actual === undefined, 'Expected value to be undefined');
    },
    toBeNull() {
      assert(actual === null, 'Expected value to be null');
    },
    toBeGreaterThan(value) {
      assert(actual > value, `Expected ${actual} to be greater than ${value}`);
    },
    toBeLessThan(value) {
      assert(actual < value, `Expected ${actual} to be less than ${value}`);
    },
    toHaveLength(length) {
      assert.strictEqual(actual.length, length, `Expected length ${actual.length} to be ${length}`);
    },
    rejects: {
      async toThrow() {
        try {
          await actual;
          throw new Error('Expected promise to reject');
        } catch (e) {
          // Expected
        }
      }
    }
  };
}

export const expect = (actual) => createExpect(actual);

expect.not = {
  toBe(actual, expected) {
    assert.notStrictEqual(actual, expected);
  },
  toEqual(actual, expected) {
    assert.notDeepStrictEqual(actual, expected);
  },
  toContain(actual, value) {
    if (Array.isArray(actual)) {
      assert(!actual.includes(value), `Expected array not to contain ${value}`);
    } else if (typeof actual === 'string') {
      assert(!actual.includes(value), `Expected string not to contain "${value}"`);
    }
  }
};
