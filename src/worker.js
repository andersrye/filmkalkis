import {cartesianGenerator, fixDates, hasOverlap, stringToColour} from "./utils.js";
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

function* calculatePlans(selectedFilms, lockedEvents, excludeEvents) {
  console.log(`WORKER calculating!`)
  if (selectedFilms.length === 0) return []
  if (selectedFilms.length === 1) return eventsByName[selectedFilms[0]].map(f=>[f])
  const selectedEvents = selectedFilms.map(t => lockedEvents[t]?.map(fixDates) ?? eventsByName[t])
  const product = cartesianGenerator(...selectedEvents)
  for (const plan of product) {
    if(!hasOverlap([...plan, ...excludeEvents], travelTimes, margin)) {
      yield plan
    }
  }
}
const sleep = (ms = 0) => new Promise(r => setTimeout(r, ms))

let working = false
let abort = false
onmessage = async function(message) {
  const {data: {type}, data} = message
  console.log('WORKER message recieved', data, 'type', type)
  if(type === 'calculate') {
    const {reqId, selectedFilms, excludeEvents, lockedEvents} = data
    if(working) {
      abort = true
      console.log(`WORKER waiting ${reqId}`)
      while(working) await sleep(1)
    }
    console.log(`WORKER starting ${reqId}`)
    working = true
    const combinations = calculateCombinations(selectedFilms)
    postMessage({type: 'combinations', reqId, combinations})
    let count = 0
    for (const plan of calculatePlans(selectedFilms, lockedEvents, excludeEvents)) {
      if(count++ % 100 === 0) {
        await sleep()
        if(abort) break
      }
      postMessage({type: 'plan', reqId, plan})
    }
    if(abort) {
      console.log(`WORKER aborted ${reqId}`)
      abort = false
      postMessage({type: 'abort', reqId})
    } else {
      console.log(`WORKER finished ${reqId}`)
      postMessage({type: 'end', reqId})
    }
    working = false
  } else {
    console.error("WORKER unhandled message", message)
  }
}