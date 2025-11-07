import { describe, it, expect } from "vitest";
import { updateEventByUid } from "./update-event.js";

describe('updateEventByUid', () => {
  const events = [
    { uid: 'abc', name: 'Event 1', description: 'jeden'},
    { uid: 'def', name: 'Event 2', description: 'dwa' },
    { uid: 'ghi', name: 'Event 3', description: 'czy' },
  ];

    const dataForChange = {name:'Event 4', description: 'trzy'}

  it('should modify an events name', () => {
    const updatedEvents = updateEventByUid(dataForChange, events, 'ghi');
    expect(updatedEvents).toEqual([
      { uid: 'abc', name: 'Event 1', description: 'jeden' },
      { uid: 'def', name: 'Event 2', description: 'dwa' },
      { uid: 'ghi', name: 'Event 4', description: 'trzy' },
    ]);
  });
})