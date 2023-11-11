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

export function cartesian(...args) {
  const r = [], max = args.length-1;
  function helper(arr, i) {
    for (let j=0, l=args[i].length; j<l; j++) {
      const a = arr.slice(0); // clone arr
      a.push(args[i][j]);
      if (i===max)
        r.push(a);
      else
        helper(a, i+1);
    }
  }
  helper([], 0);
  return r;
}
export function* cartesianGenerator(...args) {
  const  max = args.length-1;
  function* helper(arr, i) {
    for (let j=0, l=args[i].length; j<l; j++) {
      const a = arr.slice(0); // clone arr
      a.push(args[i][j]);
      if (i===max)
        yield a
      else
        yield* helper(a, i+1);
    }
  }
  yield* helper([], 0);
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
      const o = overlaps(a, b, totalMargin)
      if (o) return true
    }
  }
  return false
}