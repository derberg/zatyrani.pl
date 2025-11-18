import { describe, it, expect } from 'vitest';
import { deleteByUid } from '../src/utils/events.js';

describe('deleteByUid', () => {
  const events = [
    { uid: 'abc', name: 'Event 1' },
    { uid: 'def', name: 'Event 2' },
    { uid: 'ghi', name: 'Event 3' },
  ];

  it('should remove an event with a matching UID', () => {
    const updatedEvents = deleteByUid(events, 'def');
    expect(updatedEvents).toEqual([
      { uid: 'abc', name: 'Event 1' },
      { uid: 'ghi', name: 'Event 3' },
    ]);
  });

  it('should return null if no event with the given UID is found', () => {
    const updatedEvents = deleteByUid(events, 'jkl');
    expect(updatedEvents).toBeNull();
  });

  it('should not modify the original array', () => {
    const originalEvents = [...events];
    deleteByUid(events, 'def');
    expect(events).toEqual(originalEvents);
  });
});
