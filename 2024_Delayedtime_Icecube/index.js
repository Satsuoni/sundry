import strings from './assets/geometry_strings.js'
import doms from './assets/geometry.js'
import test_event from './assets/test_event.js'

function createStrings(scaleFactor) {
    for(let string of strings) {
        let entity = document.createElement('a-entity');
        entity.setAttribute('instanced-mesh-member', 'mesh:#string-mesh');
        entity.setAttribute('position', `${string.x * scaleFactor} -15 ${string.y * scaleFactor}`);
        document.querySelector('a-scene').appendChild(entity);
    }
}

function createDOMs(scaleFactor) {
    for(let dom of doms) {
        let entity = document.createElement('a-entity')
        entity.setAttribute('instanced-mesh-member', 'mesh:#dom-mesh')
        entity.setAttribute('id', `dom-${dom.string_no}-${dom.module_no}`)
        entity.setAttribute('coords', `${dom.x},${dom.y},${dom.z}`);
        entity.setAttribute('position', `${dom.x * scaleFactor} ${dom.z * scaleFactor - 15} ${dom.y * scaleFactor}`);
        document.querySelector('a-scene').appendChild(entity);
    }
}

const clearPulses = () => document.querySelectorAll('.pulse').forEach(pulse => pulse.remove());

function chargeToColor(minCharge, maxCharge, charge) {
    const hue = ((charge - minCharge) / (maxCharge - minCharge)) * 360;
    return `hsl(${hue}, 100%, 50%)`;
}

function createPulses(pulsemap, scaleFactor) {
    const minTime = Math.min(...pulsemap.map(p => p[0]));
    const maxTime = Math.max(...pulsemap.map(p => p[0]));
    const timeSpan = maxTime - minTime
    const minCharge = Math.min(...pulsemap.map(p => p[3]));
    const maxCharge = Math.max(...pulsemap.map(p => p[3]));

    let pulses = [];
    for(let pulse of pulsemap) {
        let [time, string_no, module_no, charge] = pulse;
        if (typeof string_no === "undefined" || typeof module_no === "undefined") continue;
        let om = document.querySelector(`#dom-${string_no}-${module_no}`);
        let delay = (time - minTime) / timeSpan * 5000;
        setTimeout(() => {
            let entity = document.createElement('a-sphere');
            entity.setAttribute('radius', Math.sqrt(charge) * 0.25);
            entity.setAttribute('color', 'purple');
            entity.setAttribute('segments-height', 10);
            entity.setAttribute('segments-width', 10);
            let coords = om.getAttribute('coords').split(',').map(Number);
            entity.setAttribute('position', `${coords[0] * scaleFactor} ${coords[2] * scaleFactor - 15} ${coords[1] * scaleFactor}`);
            entity.setAttribute('class', 'pulse');
            document.querySelector('a-scene').appendChild(entity);
        }, delay);
    }
    //setTimeout(clearPulses, 5000);
}

const clearTrack = () => document.querySelectorAll('.track_point').forEach(pulse => pulse.remove());

function createTrack(track) {
    const length = 720;
    const dots = 100;
    const midpoint = track.slice(0, 3);
    const direction = track.slice(3, 6);
    const startPos = midpoint.map((val, idx) => val + length * direction[idx]);
    const endPos = midpoint.map((val, idx) => val - length * direction[idx]);
  
    for (let i = 0; i < dots; i++) {
      let entity = document.createElement('a-entity');
      entity.setAttribute('instanced-mesh-member', 'mesh:#path-mesh');
      
      const t = i / (dots - 1);  // Normalized parameter from 0 to 1
      const x = startPos[0] + t * (endPos[0] - startPos[0]);
      const y = startPos[1] + t * (endPos[1] - startPos[1]);
      const z = startPos[2] + t * (endPos[2] - startPos[2]);
      
      // Note the order: x, y, z in A-Frame corresponds to x, z, -y in typical 3D space
      entity.setAttribute('position', `${x * scaleFactor} ${z * scaleFactor - 15} ${y * scaleFactor}`);
      entity.setAttribute('class', 'track_point');
      document.querySelector('a-scene').appendChild(entity); 
    }
    animateEvent(startPos, endPos, scaleFactor);
}

const duration = 5000; // Animation duration in milliseconds
function animateEvent(startPos, endPos, scaleFactor) {
    let anim = document.createElement('a-entity');
    let neutrino = document.createElement('a-sphere');
    neutrino.setAttribute('radius', 0.5);
    neutrino.setAttribute('color', 'red');
    neutrino.setAttribute('id', 'neutrino');
    anim.appendChild(neutrino);
    anim.setAttribute('id', 'animation');
  
    // Set the initial position
    const initialPosition = `${startPos[0] * scaleFactor} ${startPos[2] * scaleFactor - 15} ${startPos[1] * scaleFactor}`;
    anim.setAttribute('position', initialPosition);
  
    // Create the animation
    anim.setAttribute('animation', {
      property: 'position',
      from: initialPosition,
      to: `${endPos[0] * scaleFactor} ${endPos[2] * scaleFactor - 15} ${endPos[1] * scaleFactor}`,
      dur: duration,
      easing: 'linear',
      loop: false
    });
    document.querySelector('a-scene').appendChild(anim);
}
const clearAnim = () => document.querySelectorAll('#animation').forEach(neu => neu.remove());

function clearAll() {
  clearTrack();
  clearPulses();
  clearAnim();
}

async function fetchPulsemap() {
    const pulsemap = await fetch(`https://ar.obolus.net/last_cached_event`);
    const data = await pulsemap.json();
    // Split by lines
    const csv = data.data.split('\n')
    const track = csv[1].split(',').map(Number);
    const pulses = csv.slice(2);
    const lines = pulses.map(line => line.split(',').map(Number));
    return [track, lines,data.event_id,data.run_id];
}

AFRAME.registerComponent('click-particle', {
    init: function() {
        this.becomeNeutrino = function() {
            let cam = document.createElement('a-camera');
            let anim = document.querySelector('#animation');
            cam.setAttribute('position', '0 0 0');
            cam.setAttribute('look-controls', '');
            cam.setAttribute('wasd-controls-enabled', 'false');
            cam.setAttribute('rotation', '0 0 0');
            anim.appendChild(cam); // Become the neutrino
        }
        this.el.addEventListener('click', this.becomeNeutrino);
    },

    remove: function() {
        this.el.removeEventListener('click', this.becomeNeutrino);
    }
});

function createEventText(event) {
    let data = event.value.data;
    let text = document.createElement('a-text');
    const [run_id, event_id, azi, zen] = [data.run_id, data.event_id, data.reco.splinempe.azi, data.reco.splinempe.zen];
    text.setAttribute('value', `Run ID: ${run_id}\nEvent ID: ${event_id}\nAzimuth: ${azi}\nZenith: ${zen}`);
    text.setAttribute('position', '0 0.75 -1');
    text.setAttribute('align', 'center');
    text.setAttribute('width', '1');
    text.setAttribute('color', 'green');
    text.setAttribute('id', 'event-text');
    // Child of camera
    document.querySelector('#camera').appendChild(text);
}

function createEventText2(rid,eid) {
    let text = document.createElement('a-text');
    const [run_id, event_id] = [rid, eid];
    text.setAttribute('value', `Run ID: ${run_id}\nEvent ID: ${event_id}\n`);
    text.setAttribute('position', '0 0.75 -1');
    text.setAttribute('align', 'center');
    text.setAttribute('width', '1');
    text.setAttribute('color', 'green');
    text.setAttribute('id', 'event-text');
    // Child of camera
    document.querySelector('#camera').appendChild(text);
}

const scaleFactor = 0.03;
async function tryReload() {
  try {
    //let event = await fetchEvent();
    //createEventText(event);
    //console.log(event);
    let [direction, pulsemap,evid,rid] = await fetchPulsemap();
    clearAll();
    createEventText2(rid,evid)
    createPulses(pulsemap, scaleFactor)
    createTrack(direction);
    createDOMs(scaleFactor);
    document.querySelector('#loading-text').remove();
} catch (e) {
    console.log(e);
}

}
//stolen from medium 
function SmartInterval(asyncFn, delayMs) {
  this.asyncFn = asyncFn;
  this.delayMs = delayMs;
  this.running = false;
}
SmartInterval.prototype.cycle = async function (forced) {
  await this.asyncFn();
  await this.delay(this.delayMs);
  if (!forced && this.running) this.cycle();
};
SmartInterval.prototype.delay = function (ms) {
  return new Promise(res =>
    setTimeout(() => res(1), ms)
  );
};
SmartInterval.prototype.start = function () {
  if (this.running) return;
  this.running = true;
  this.cycle();
};
SmartInterval.prototype.stop = function () {
  if (this.running) this.running = false;
};
SmartInterval.prototype.forceExecution = function () {
  if (this.running) this.cycle(true);
};


let interval = new SmartInterval(tryReload, 15000);
interval.start();