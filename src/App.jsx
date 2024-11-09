import './App.css'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import {useEffect, useReducer, useRef, useState} from "react"
import program from './program.json'
import {fixDates, generateId, useLocalStorageState} from "./utils.js";

const worker = new Worker(new URL('./worker.js', import.meta.url), {type: 'module'})
worker.onerror = e => console.error('worker error!', e)

const filmTitles = Array.from(program.reduce((acc, val) => (acc.add(val.name), acc), new Set())).sort()
const startDate = new Date(program[0].date)
const currentYear = startDate.getFullYear()

if(localStorage.getItem('year') !== currentYear.toString()) {
  console.log('clear')
  localStorage.clear()
  localStorage.setItem('year', currentYear.toString())
}

async function* calculate(selectedFilms, excludeEvents, lockedEvents) {
  const reqId = generateId()
  console.log('STARTING', reqId)
  let defer
  const callback = ({data})=> {
    if(data.reqId === reqId) defer.resolve(data)
  }
  worker.addEventListener('message', callback)
  worker.postMessage({
    type:'calculate',
    reqId,
    selectedFilms,
    excludeEvents,
    lockedEvents
  })

  while(true) {
    defer = Promise.withResolvers()
    const res = await defer.promise
    if(res.type === 'end' || res.type === 'abort') {
      break
    } else if(res.type === 'combinations') {
      yield res.combinations
    } else if(res.type === 'plan') {
      yield res.plan
    }
  }
  worker.removeEventListener('message', callback)
}

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
  const [loading, setLoading] = useState(false)

  function addFilm(film) {
    setSelectedFilms([...selectedFilms, film])
  }

  function removeFilm(film) {
    setSelectedFilms(selectedFilms.filter(f => f !== film))
  }

  useEffect(() => {
    if(selectedFilms != null && excludeEvents != null && lockedEvents != null) {
      setSelectedPlan(0)
      const calc = async () => {
        const results = calculate(selectedFilms, excludeEvents, lockedEvents)
        setCombinations((await results.next()).value)
        setLoading(true)
        planDispatch({type:'reset'})
        for await (const plan of results) {
          planDispatch({type: 'add', value: plan})
        }
      }
      calc()
        .finally(() => setLoading(false))
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
        <div style={{height: "100vh", overflow: "auto", flex: "1", textAlign: "left", position: "relative"}}>
          <button
            disabled={selectedPlan === 0}
            onClick={() => {
              setSelectedPlan(selectedPlan - 1)
            }}
          >forrige plan
          </button>
          <span style={{margin: "0 0.5rem"}}>Plan {selectedPlan + 1} av {plans.length} </span>
          {loading && <span className={'loader-container'}><span className={'loader'}></span></span>}
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
            locale={"no"}
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
