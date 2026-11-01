// In-memory task store. Deliberately simple: no database, no dependencies.
import { randomUUID } from 'node:crypto';

export const STATUSES = ['todo', 'in-progress', 'done'];

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function createStore() {
  const tasks = new Map();

  function validate(input, { partial = false } = {}) {
    if (input === null || typeof input !== 'object' || Array.isArray(input)) {
      throw new ValidationError('Body must be a JSON object');
    }
    if (!partial || 'title' in input) {
      if (typeof input.title !== 'string' || input.title.trim() === '') {
        throw new ValidationError('title must be a non-empty string');
      }
      if (input.title.length > 200) {
        throw new ValidationError('title must be at most 200 characters');
      }
    }
    if ('status' in input && !STATUSES.includes(input.status)) {
      throw new ValidationError(`status must be one of: ${STATUSES.join(', ')}`);
    }
  }

  return {
    list({ status } = {}) {
      const all = [...tasks.values()];
      return status ? all.filter((t) => t.status === status) : all;
    },
    get(id) {
      return tasks.get(id) ?? null;
    },
    create(input) {
      validate(input);
      const now = new Date().toISOString();
      const task = {
        id: randomUUID(),
        title: input.title.trim(),
        status: input.status ?? 'todo',
        createdAt: now,
        updatedAt: now,
      };
      tasks.set(task.id, task);
      return task;
    },
    update(id, patch) {
      const existing = tasks.get(id);
      if (!existing) return null;
      validate(patch, { partial: true });
      const updated = {
        ...existing,
        ...(patch.title !== undefined && { title: patch.title.trim() }),
        ...(patch.status !== undefined && { status: patch.status }),
        updatedAt: new Date().toISOString(),
      };
      tasks.set(id, updated);
      return updated;
    },
    remove(id) {
      return tasks.delete(id);
    },
  };
}
