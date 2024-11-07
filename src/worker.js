import {cartesian, cartesianGenerator, fixDates, hasOverlap, stringToColour} from "./utils.js";

let program = []
let events = []
let eventsByName = []
let travelTimes = {}
let excludeEvents = []
let lockedEvents = []
let selectedFilms = []
let margin = 5*60000

let result = {
  combinations: null,
  plans: []
}

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

function calculateCombinations() {
  if (selectedFilms.length === 0) return 0
  return selectedFilms.reduce((acc, val) => {
    return acc*eventsByName[val].length
  }, 1)
}

function calculatePlans() {
  console.log(`WORKER calculating!`)
  //console.log('selectedFilms', selectedFilms)
  //console.log('lockedEvents', lockedEvents)
  //console.log('excludeEvents', excludeEvents)
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
  return res//product.filter(plan => !hasOverlap([...plan, ...excludeEvents], travelTimes, margin))
}

//function getResult(i) {
//  console.log('WORKER getting!', i)
//  postMessage(result[i])
//}

function setConfiguration(configuration) {
  console.log('WORKER configuring!', configuration)
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
  lockedEvents = configuration.lockedEvents ?? lockedEvents
  selectedFilms = configuration.selectedFilms ?? selectedFilms
  excludeEvents = configuration.excludeEvents ?? excludeEvents
}

function getResults() {
  postMessage(result)
}

onmessage = function(message) {
  const {data: {type}, data} = message
  console.log('WORKER message recieved', data, 'type', type)
  if(type === 'getResults') {
    getResults()
  } else if(type === 'configure') {
    setConfiguration(data.configuration)
    result = {
      combinations: calculateCombinations(),
      plans: calculatePlans()
    }
  } else {
    console.error("WORKER unhandled message", message)
  }
}