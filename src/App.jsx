// import './App.css'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import program from './program.json'
import {useEffect, useMemo, useState} from "react";
import {cartesian, hasOverlap, stringToColour} from "./utils.js";


const events = program.map(f => ({
  film: f.name,
  title: `${f.name} (${f.venueSpecific})`,
  start: new Date(`${f.date}T${f.start}`),
  end: new Date(`${f.date}T${f.end}`),
  color: stringToColour(f.venue),
  venue: f.venue
}))

const currentYear = events[0].start.getFullYear()
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

const eventsByName = events.reduce((acc, event) => {
  acc[event.film] = [...(acc[event.film] ?? []), event]
  return acc
}, {})

const filmTitles = Object.keys(eventsByName).sort()

//TODO: rydd opp den her og hvor den bruke. hack
function fixDates(e){
  return {
    ...e, start: new Date(e.start), end: new Date(e.end)
  }
}

function App() {
  const [selectedFilms, setSelectedFilms] = useState(JSON.parse(localStorage.getItem('selectedFilms')) ?? [])
  const [selectedPlan, setSelectedPlan] = useState(0)
  const [excludeEvents, setExcludeEvents] = useState((JSON.parse(localStorage.getItem('excludeEvents'))??[]).map(fixDates))

  const [lockedEvents, setLockedEvents] = useState((JSON.parse(localStorage.getItem('lockedEvents')) ?? {}))


  useEffect(() => {
    localStorage.setItem('selectedFilms', JSON.stringify(selectedFilms))
  }, [selectedFilms])

  useEffect(() => {
    localStorage.setItem('excludeEvents', JSON.stringify(excludeEvents))
  }, [excludeEvents])

  useEffect(() => {
    localStorage.setItem('lockedEvents', JSON.stringify(lockedEvents))
  }, [lockedEvents])

  function addFilm(film) {
    setSelectedFilms([...selectedFilms, film])
  }

  function removeFilm(film) {
    setSelectedFilms(selectedFilms.filter(f => f !== film))
  }

  const plans = useMemo(() => {
    console.log('locked', lockedEvents)
    if (selectedFilms.length === 0) return []
    if (selectedFilms.length === 1) return eventsByName[selectedFilms[0]].map(f=>[f])
    const selectedEvents = selectedFilms.map(t => lockedEvents[t]?.map(fixDates) ?? eventsByName[t])
    const product = cartesian(...selectedEvents)
    return product.filter(plan => !hasOverlap([...plan, ...excludeEvents], travelTimes, margin))
  }, [selectedFilms, excludeEvents, lockedEvents])


  const totalPlans = useMemo(()=>  {
    if (selectedFilms.length === 0) return 0
    return selectedFilms.reduce((acc, val) => {
      return acc*eventsByName[val].length
    }, 1)
  }, [selectedFilms])

  useEffect(() => {
    setSelectedPlan(0)
  }, [plans]);

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
        <div style={{height:"100vh", overflow:"auto", flex: "1", textAlign: "left"}}>
          <button
            disabled={selectedPlan === 0}
            onClick={()=>{setSelectedPlan(selectedPlan-1)}}
          >forrige plan</button>
          <span style={{margin: "0 0.5rem"}}>Plan {selectedPlan+1} av {plans.length} </span>
          <button
            disabled={selectedPlan >= plans.length-1}
            onClick={()=>{setSelectedPlan(selectedPlan+1)}}
          >neste plan</button>
          <span style={{margin: "0 0.5rem"}}> Totale kombinasjoner {totalPlans}</span>
          <br/><br/>
          <FullCalendar
            plugins={[timeGridPlugin, interactionPlugin]}
            headerToolbar={null}
            initialView="ffs"
            initialDate={events[0].start}
            slotMinTime={'11:00:00'}
            slotMaxTime={'23:59:59'}
            eventSources={[
              plans[selectedPlan],
              excludeEvents
            ]}
            height={"44rem"}
            nowIndicator={true}
            eventClick={({event})=> {

              console.log('event click!', event.toJSON())
              if(event.title === 'Opptatt') {
                setExcludeEvents(excludeEvents.filter(e => e.start.getTime() !== event.start.getTime()))
              } else {
                if(lockedEvents[event.extendedProps.film]) {
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
            select={({start, end})=>setExcludeEvents([...excludeEvents, {
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
