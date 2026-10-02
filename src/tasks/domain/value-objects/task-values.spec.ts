import {
  InvalidAssigneeIdError,
  InvalidTaskDescriptionError,
  InvalidTaskIdError,
  InvalidTaskPriorityError,
  InvalidTaskTitleError,
} from '../errors/task.errors';
import { AssigneeId } from './assignee-id';
import { TaskDescription } from './task-description';
import { TaskId } from './task-id';
import { TaskPriority, TaskPriorityValue } from './task-priority';
import { TaskTitle } from './task-title';
import { TeamMember } from './team-member';

describe('TaskTitle (RN-006)', () => {
  it('trims and collapses whitespace', () => {
    expect(TaskTitle.create('  Preparar    demo  ').value).toBe('Preparar demo');
  });

  it.each(['', '  ', 'ab', 'x'.repeat(121)])('rejects %p', (value) => {
    expect(() => TaskTitle.create(value)).toThrow(InvalidTaskTitleError);
  });

  it('accepts boundaries and compares by value', () => {
    expect(TaskTitle.create('abc').equals(TaskTitle.create(' abc '))).toBe(true);
    expect(TaskTitle.create('x'.repeat(120)).value).toHaveLength(120);
  });
});

describe('TaskDescription (RN-007)', () => {
  it('is empty when omitted', () => {
    expect(TaskDescription.create(undefined).isEmpty()).toBe(true);
    expect(TaskDescription.create(null).equals(TaskDescription.empty())).toBe(true);
  });

  it('trims and accepts up to 2000 characters', () => {
    expect(TaskDescription.create('  detalle ').value).toBe('detalle');
    expect(TaskDescription.create('x'.repeat(2000)).value).toHaveLength(2000);
  });

  it('rejects longer descriptions and non strings', () => {
    expect(() => TaskDescription.create('x'.repeat(2001))).toThrow(InvalidTaskDescriptionError);
    expect(() => TaskDescription.create(42 as unknown as string)).toThrow(InvalidTaskDescriptionError);
  });
});

describe('TaskPriority (RN-014)', () => {
  it('defaults to MEDIUM and normalizes casing', () => {
    expect(TaskPriority.default().value).toBe(TaskPriorityValue.MEDIUM);
    expect(TaskPriority.create(' high ').value).toBe(TaskPriorityValue.HIGH);
    expect(TaskPriority.create('low').equals(TaskPriority.create('LOW'))).toBe(true);
  });

  it('rejects unknown priorities', () => {
    expect(() => TaskPriority.create('URGENT')).toThrow(InvalidTaskPriorityError);
  });
});

describe('TaskId / AssigneeId', () => {
  it('validate uuid format', () => {
    expect(() => TaskId.create('nope')).toThrow(InvalidTaskIdError);
    expect(() => AssigneeId.create('nope')).toThrow(InvalidAssigneeIdError);
    const id = TaskId.generate();
    expect(TaskId.create(id.value.toUpperCase()).equals(id)).toBe(true);
  });
});

describe('TeamMember', () => {
  it('exposes availability and compares by value', () => {
    const id = AssigneeId.create('7c9e6679-7425-40de-944b-e07fc1f90ae7');
    const active = TeamMember.create({ id, active: true });
    expect(active.isActive()).toBe(true);
    expect(active.equals(TeamMember.create({ id, active: true }))).toBe(true);
    expect(active.equals(TeamMember.create({ id, active: false }))).toBe(false);
  });
});
