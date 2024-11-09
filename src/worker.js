import { fixDates, hasOverlap, stringToColour} from "./utils.js";
import program from './program.json'

const events = program.map((film, index) => ({
  id: index,
  film: film.name,
  title: `${film.name} (${film.venueSpecific})`,
  start: new Date(`${film.date}T${film.start}`),
  end: new Date(`${film.date}T${film.end}`),
  color: stringToColour(film.venue),
  venue: film.venue
}))

const eventsByName = events.reduce((acc, event) => {
  acc[event.film] = [...(acc[event.film] ?? []), event]
  return acc
}, {})

const margin = 5*60000
const travelTimeVikaVega= 26*60000
const travelTimeCinVega= 19*60000
const travelTimeVikaCin= 16*60000

const travelTimes = {
  "Cinemateket": {
    "Vika-Kino": travelTimeVikaCin,
    "VegaScene": travelTimeCinVega,
    "Cinemateket": 0,
  },
  "Vika-Kino": {
    "Vika-Kino": 0,
    "VegaScene": travelTimeCinVega,
    "Cinemateket": travelTimeVikaCin,
  },
  "Vega-Scene": {
    "Vika-Kino": travelTimeVikaVega,
    "VegaScene": 0,
    "Cinemateket": travelTimeCinVega,
  }
}

function calculateCombinations(selectedFilms) {
  if (selectedFilms.length === 0) return 0
  return selectedFilms.reduce((acc, val) => {
    return acc*eventsByName[val].length
  }, 1)
}

let iterations = 0
function* iteratePlans(currentPlan, selectedEvents, excludeEvents, travelTimes, margin) {
  if(currentPlan.length === 0) iterations = 0
  iterations++
  const nextFilmShowings = selectedEvents[0]
  if(!nextFilmShowings) {
    yield currentPlan
    return
  }
  for (const showing of nextFilmShowings) {
    const next = [...currentPlan, showing]
    if(!hasOverlap([...next, ...excludeEvents], travelTimes, margin)) {
      yield* iteratePlans(next, selectedEvents.slice(1), excludeEvents, travelTimes, margin)
    }
  }
}

function calculatePlans(selectedFilms, lockedEvents, excludeEvents) {
  if (selectedFilms.length === 0) return []
  if (selectedFilms.length === 1) return eventsByName[selectedFilms[0]].map(f=>[f])
  const selectedEvents = selectedFilms.map(t => lockedEvents[t]?.map(fixDates) ?? eventsByName[t])
  return iteratePlans([], selectedEvents, excludeEvents, travelTimes, margin)
}

const sleep = (ms = 0) => new Promise(r => setTimeout(r, ms))

let working = false
let abort = false
onmessage = async function(message) {
  const {data: {type}, data} = message
  if(type === 'calculate') {
    const {reqId, selectedFilms, excludeEvents, lockedEvents} = data
    while(working) {
      abort = true
      console.log(`WORKER ${reqId} waiting`)
      await sleep()
    }
    console.log(`WORKER ${reqId} starting`)
    working = true
    const combinations = calculateCombinations(selectedFilms)
    postMessage({type: 'combinations', reqId, combinations})
    let count = 0
    let plans = []
    for (const plan of calculatePlans(selectedFilms, lockedEvents, excludeEvents)) {
      plans.push(plan)
      if(count++ % 13 === 0) {
        await sleep()
        if(abort) break
        postMessage({type: 'plans', reqId, plans})
        plans = []
      }
    }
    postMessage({type: 'plans', reqId, plans})
    postMessage({type: 'end', reqId})
    console.log(`WORKER ${reqId} finished. aborted=${abort}, count=${count}, combinations=${combinations}, iterations=${iterations}`)
    abort = false
    working = false
  } else {
    console.error("WORKER unhandled message", message)
  }
}