// import './App.css'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import {useEffect, useReducer, useState} from "react"
import program from './program.json'
import {fixDates, generateId, useLocalStorageState} from "./utils.js";

const worker = new Worker(new URL('./worker.js', import.meta.url), {type: 'module'})
worker.onerror = e => console.error('worker error!', e)

function init(program, travelTimes, margin) {
  worker.postMessage({
    type: 'init',
    configuration: { program, travelTimes, margin }
  })
}

function calculate(selectedFilms, excludeEvents, lockedEvents) {
  const reqId = generateId()
  let {promise, resolve} = Promise.withResolvers()
  const callback = (message)=> {
    console.log('message!', message)
    if(message.data.reqId === reqId) {
      resolve(message.data)
    }
  }
  worker.addEventListener('message', callback)
  promise.finally(()=> worker.removeEventListener('message', callback))
  worker.postMessage({
    type:'calculate',
    reqId,
    selectedFilms,
    excludeEvents,
    lockedEvents
  })
  return promise
}

const startDate = new Date(program[0].date)
const currentYear = startDate.getFullYear()
if(localStorage.getItem('year') !== currentYear.toString()) {
  console.log('clear')
  localStorage.clear()
  localStorage.setItem('year', currentYear.toString())
}

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

const filmTitles = Array.from(program.reduce((acc, val) => (acc.add(val.name), acc), new Set())).sort()

init(program, travelTimes, margin)

function planReducer(acc, cmd) {
  if(cmd.type === 'reset') {
    return cmd.value || []
  } else if (cmd.type === 'add') {
    return [...acc, cmd.value]
  }
}

function App() {
  const [selectedFilms, setSelectedFilms] = useLocalStorageState('selectedFilms', [])
  const [selectedPlan, setSelectedPlan] = useLocalStorageState('selectedPlan', 0)
  const [excludeEvents, setExcludeEvents] = useLocalStorageState('excludeEvents',[], v=>v.map(fixDates))
  const [lockedEvents, setLockedEvents] = useLocalStorageState('lockedEvents',{})
  const [plans, planDispatch] = useReducer(planReducer, [])
  const [combinations, setCombinations] = useState(0)
  const [loading, setLoading] = useState(true)

  function addFilm(film) {
    setSelectedFilms([...selectedFilms, film])
  }

  function removeFilm(film) {
    setSelectedFilms(selectedFilms.filter(f => f !== film))
  }

  useEffect(() => {
    if(selectedFilms != null && excludeEvents != null && lockedEvents != null) {
      setSelectedPlan(0)
      setLoading(true)
      calculate(
        selectedFilms, excludeEvents, lockedEvents
      ).then(res => {
        console.log('RES', res)
        setCombinations(res.combinations)
        planDispatch({type: 'reset', value: res.plans})
      }).finally(() => {
        setLoading(false)
      })
    }
  }, [selectedFilms, excludeEvents, lockedEvents])

  return (
    <>
      <div style={{display: "flex", flexDirection: "row", height: "100vh"}}>
        <div style={{height:"100%", overflowY:"scroll", overflowX: "hidden", flex: "0 0 20rem"}}>
          {filmTitles.map(title => (
            <label key={title} style={{display: "block"}}>
              <input
                type='checkbox'
                checked={selectedFilms.find(f => f === title) !== undefined}
                onChange={e => {
                  e.currentTarget.checked ? addFilm(title) : removeFilm(title)
                }}
              />
              {title}
            </label>))}

        </div>
        <div style={{height: "100vh", overflow: "auto", flex: "1", textAlign: "left", position:"relative"}}>
          {loading && <div style={{
            background: "#fffb",
            height: "100%",
            width: "100%",
            position: "absolute",
            top: 0,
            left: 0,
            zIndex: "1000",
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            Et øyeblikk...
          </div>}
          <button
            disabled={selectedPlan === 0}
            onClick={() => {
              setSelectedPlan(selectedPlan - 1)
            }}
          >forrige plan
          </button>
          <span style={{margin: "0 0.5rem"}}>Plan {selectedPlan + 1} av {plans.length} </span>
          <button
            disabled={selectedPlan >= plans.length - 1}
            onClick={() => {
              setSelectedPlan(selectedPlan + 1)
            }}
          >neste plan
          </button>
          <span style={{margin: "0 0.5rem"}}> Totale kombinasjoner {combinations}</span>
          <br/><br/>
          <FullCalendar
            plugins={[timeGridPlugin, interactionPlugin]}
            headerToolbar={null}
            initialView="ffs"
            initialDate={startDate}
            slotMinTime={'11:00:00'}
            slotMaxTime={'23:59:59'}
            eventSources={[
              plans[selectedPlan],
              excludeEvents
            ]}
            height={"44rem"}
            nowIndicator={true}
            eventClick={({event}) => {

              console.log('event click!', event.toJSON())
              if (event.title === 'Opptatt') {
                setExcludeEvents(excludeEvents.filter(e => e.start.getTime() !== event.start.getTime()))
              } else {
                if (lockedEvents[event.extendedProps.film]) {
                  setLockedEvents({
                    ...lockedEvents,
                    [event.extendedProps.film]: undefined
                  })
                } else {
                  setLockedEvents({
                    ...lockedEvents,
                    [event.extendedProps.film]: [{
                      ...event.toJSON(),
                      title: `🔒 ${event.title}`
                    }
                    ]
                  })
                }
              }
            }}
            selectable={true}
            select={({start, end}) => setExcludeEvents([...excludeEvents, {
              start, end, title: "Opptatt", color: "#777", type: 'exclude'
            }])}
            views={{
              ffs: {
                type: 'timeGrid',
                duration: {days: 9},
                buttonText: '9 day',
                selectable: true
              }
            }}
          />
        </div>
      </div>
    </>
  )
}

export default App
