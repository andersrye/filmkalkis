// sum.test.js
import {expect, test} from 'vitest'
import {cartesianGenerator, overlaps} from "./utils.js";

const eventA = {
  start: new Date("2023-10-01T16:00"),
  end: new Date("2023-10-01T16:30")
}
const eventB = {
  start: new Date("2023-10-01T16:35"),
  end: new Date("2023-10-01T17:00")
}
const eventC = {
  start: new Date("2023-10-01T16:20"),
  end: new Date("2023-10-01T16:50")
}

test('overlaps', () => {

  expect(overlaps(eventA, eventB)).toBe(false)
  expect(overlaps(eventB, eventA)).toBe(false)

  expect(overlaps(eventA, eventC)).toBe(true)
  expect(overlaps(eventC, eventA)).toBe(true)

  expect(overlaps(eventB, eventC)).toBe(true)
  expect(overlaps(eventC, eventB)).toBe(true)

  expect(overlaps(eventA, eventB, 10*60000)).toBe(true)
  expect(overlaps(eventB, eventA, 10*60000)).toBe(true)

  expect(overlaps(eventA, eventB, 4*60000)).toBe(false)
  expect(overlaps(eventB, eventA, 4*60000)).toBe(false)

})

test('cartesian generator', () => {
  const a = [1, 2, 3]
  const b = [9,8]
  const gen = cartesianGenerator(a, b)
  expect(gen.next().value).toStrictEqual([1, 9])
  expect(gen.next().value).toStrictEqual([1, 8])
  expect(gen.next().value).toStrictEqual([2, 9])

})