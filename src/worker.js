import {cartesianGenerator, fixDates, hasOverlap, stringToColour} from "./utils.js";

let program = []
let events = []
let eventsByName = []
let travelTimes = {}
let margin = 5*60000

function programToEvents(program) {
  return program.map((film, index) => ({
    id: index,
    film: film.name,
    title: `${film.name} (${film.venueSpecific})`,
    start: new Date(`${film.date}T${film.start}`),
    end: new Date(`${film.date}T${film.end}`),
    color: stringToColour(film.venue),
    venue: film.venue
  }))
}

function calculateCombinations(selectedFilms) {
  if (selectedFilms.length === 0) return 0
  return selectedFilms.reduce((acc, val) => {
    return acc*eventsByName[val].length
  }, 1)
}

function calculatePlans(selectedFilms, lockedEvents, excludeEvents) {
  console.log(`WORKER calculating!`)
  if (selectedFilms.length === 0) return []
  if (selectedFilms.length === 1) return eventsByName[selectedFilms[0]].map(f=>[f])
  const selectedEvents = selectedFilms.map(t => lockedEvents[t]?.map(fixDates) ?? eventsByName[t])
  const product = cartesianGenerator(...selectedEvents)
  const res = []
  for (const plan of product) {
    if(!hasOverlap([...plan, ...excludeEvents], travelTimes, margin)) {
      res.push(plan)
    }
  }
  return res
}

function init(configuration) {
  console.log('WORKER init!', configuration)
  if(configuration.program) {
    program = configuration.program
    events = programToEvents(program)
    eventsByName = events.reduce((acc, event) => {
      acc[event.film] = [...(acc[event.film] ?? []), event]
      return acc
    }, {})
  }
  margin = configuration.margin ?? margin
  travelTimes = configuration.travelTimes ?? travelTimes
}


onmessage = async function(message) {
  const {data: {type}, data} = message
  console.log('WORKER message recieved', data, 'type', type)
  if(type === 'init') {
    init(data.configuration)
  } else if(type === 'calculate') {
    const {reqId, selectedFilms, excludeEvents, lockedEvents} = data
    const combinations = calculateCombinations(selectedFilms)
    const plans = calculatePlans(selectedFilms, lockedEvents, excludeEvents)
    postMessage({type: 'result', reqId, combinations, plans})
  } else {
    console.error("WORKER unhandled message", message)
  }
}