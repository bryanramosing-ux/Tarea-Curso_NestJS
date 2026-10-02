import { InvalidTaskStatusError } from '../errors/task.errors';
import { TaskStatus, TaskStatusValue } from './task-status';

const s = (value: string) => TaskStatus.create(value);

describe('TaskStatus (RN-009)', () => {
  it('normalizes casing and spaces', () => {
    expect(s(' in_progress ').value).toBe(TaskStatusValue.IN_PROGRESS);
  });

  it.each(['', 'BLOCKED', 'DOING'])('rejects unknown status %p', (value) => {
    expect(() => s(value)).toThrow(InvalidTaskStatusError);
  });

  it.each([
    ['TODO', 'IN_PROGRESS', true],
    ['TODO', 'IN_REVIEW', false],
    ['TODO', 'DONE', false],
    ['TODO', 'TODO', false],
    ['IN_PROGRESS', 'TODO', true],
    ['IN_PROGRESS', 'IN_REVIEW', true],
    ['IN_PROGRESS', 'DONE', false],
    ['IN_REVIEW', 'IN_PROGRESS', true],
    ['IN_REVIEW', 'DONE', true],
    ['IN_REVIEW', 'TODO', false],
    ['DONE', 'TODO', false],
    ['DONE', 'IN_PROGRESS', false],
    ['DONE', 'IN_REVIEW', false],
  ])('%s -> %s allowed: %s', (from, to, allowed) => {
    expect(s(from).canTransitionTo(s(to))).toBe(allowed);
  });

  it('only TODO can exist without an assignee (RN-010)', () => {
    expect(TaskStatus.todo().requiresAssignee()).toBe(false);
    expect(s('IN_PROGRESS').requiresAssignee()).toBe(true);
    expect(s('IN_REVIEW').requiresAssignee()).toBe(true);
    expect(s('DONE').requiresAssignee()).toBe(true);
  });

  it('compares by value', () => {
    expect(s('done').equals(s('DONE'))).toBe(true);
    expect(s('DONE').equals(TaskStatus.todo())).toBe(false);
  });
});
