import {useEffect, useState} from "react";

export function stringToColour(string) {
  const hash = string
  .split('')
  .reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0)
  let colour = '#'
  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xff
    colour += value.toString(16).padStart(2, '0')
  }
  return colour
}

//TODO: overlapper hvis events starter og slutter samtidig
export function overlaps(a, b, marginMs = 0) {
  return (a.start <= b.start && b.start <= a.end)
    || (a.start <= b.end && b.end <= a.end)
    || (b.start < a.start && a.end < b.end)
    || ((b.start >= a.end) && (b.start - a.end <= marginMs))
    || ((a.start >= b.end) && (a.start - b.end <= marginMs))
}

export function hasOverlap(events, travelTimes = {}, margin = 0) {
  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const a = events[i]
      const b = events[j]
      const minMargin = (a.title === 'Opptatt' || b.title === 'Opptatt') ? 0 : margin
      const totalMargin = minMargin + (travelTimes[a.venue]?.[b.venue] ?? 0)
      const hasOverlap = overlaps(a, b, totalMargin)
      if (hasOverlap) return true
    }
  }
  return false
}

//TODO: rydd opp den her og hvor den bruke. hack
export function fixDates(e){
  return {
    ...e, start: new Date(e.start), end: new Date(e.end)
  }
}

let id = 0
export function generateId() {
  return id++
}

export function useLocalStorageState(key, initialValue, transformFn) {
  let initialState = JSON.parse(localStorage.getItem(key)) ?? initialValue
  if (transformFn) initialState = transformFn(initialState)
  const [state, setState] = useState(initialState)

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(state))
  }, [key, state])

  return [state, setState]
}