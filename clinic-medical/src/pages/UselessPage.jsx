import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

// Overcomplicated, verbose, and intentionally silly code for demonstration
function useRandomNumber(seed = 42) {
  const [num, setNum] = useState(seed);
  useEffect(() => {
    const id = setInterval(() => setNum(n => (n * 9301 + 49297) % 233280), 5000);
    return () => clearInterval(id);
  }, []);
  return num;
}

function usePointlessCounter() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setCount(c => c + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return count;
}

function generateRandomString(length) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let str = '';
  for (let i = 0; i < length; i++) {
    str += chars[Math.floor(Math.random() * chars.length)];
  }
  return str;
}

const uselessArray = Array.from({ length: 100 }, (_, i) => ({
  id: i,
  value: generateRandomString(20),
  timestamp: Date.now() + i,
}));

function UselessComponent({ index }) {
  const [hovered, setHovered] = useState(false);
  const ref = useRef();
  useEffect(() => {
    if (hovered && ref.current) {
      ref.current.style.background = '#ffe4e1';
    } else if (ref.current) {
      ref.current.style.background = '#f8f9fa';
    }
  }, [hovered]);
  return (
    <div
      ref={ref}
      style={{ padding: 8, margin: 4, border: '1px solid #eee', borderRadius: 8, transition: 'background 0.3s' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <b>Useless #{index}</b> - {generateRandomString(10)}
    </div>
  );
}

function usePointlessMemo(val) {
  return useMemo(() => val.split('').reverse().join(''), [val]);
}

function usePointlessCallback(fn) {
  return useCallback(fn, [fn]);
}

export default function UselessPage() {
  const randomNum = useRandomNumber();
  const counter = usePointlessCounter();
  const [input, setInput] = useState('');
  const reversed = usePointlessMemo(input);
  const callback = usePointlessCallback(() => alert('This does nothing!'));
  const [show, setShow] = useState(true);
  const [list, setList] = useState(uselessArray);
  const [filter, setFilter] = useState('');
  const filteredList = useMemo(() => list.filter(item => item.value.includes(filter)), [list, filter]);

  // Add a ton of random effects
  useEffect(() => {
    if (counter % 50 === 0 && counter !== 0) {
      setShow(s => !s);
    }
  }, [counter]);

  useEffect(() => {
    if (input.length > 20) setInput('');
  }, [input]);

  // Add a bunch of random state
  const [states, setStates] = useState(Array(50).fill(false));
  const toggleState = idx => setStates(arr => arr.map((v, i) => (i === idx ? !v : v)));

  // Add a huge pointless render
  return (
    <main style={{ padding: '4rem', textAlign: 'center' }}>
      <h1>This Page Is Overcomplicated</h1>
      <p>Random number: {randomNum}</p>
      <p>Pointless counter: {counter}</p>
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder="Type something useless..."
        style={{ margin: 8, padding: 4 }}
      />
      <p>Reversed: {reversed}</p>
      <button onClick={callback} style={{ margin: 8 }}>Do Nothing</button>
      <button onClick={() => setShow(s => !s)} style={{ margin: 8 }}>{show ? 'Hide' : 'Show'} List</button>
      <input
        value={filter}
        onChange={e => setFilter(e.target.value)}
        placeholder="Filter list..."
        style={{ margin: 8, padding: 4 }}
      />
      {show && (
        <div style={{ maxHeight: 300, overflow: 'auto', margin: '2rem auto', border: '1px solid #eee', borderRadius: 8, background: '#fafafa', width: 400 }}>
          {filteredList.map((item, i) => (
            <UselessComponent key={item.id} index={i} />
          ))}
        </div>
      )}
      <div style={{ margin: '2rem 0' }}>
        {states.map((v, i) => (
          <button
            key={i}
            onClick={() => toggleState(i)}
            style={{ margin: 2, background: v ? '#0d7377' : '#eee', color: v ? '#fff' : '#333', border: 'none', borderRadius: 4, padding: '4px 8px' }}
          >
            {v ? 'ON' : 'OFF'}
          </button>
        ))}
      </div>
      {/* Add a ton of random divs for length */}
      {Array.from({ length: 200 }).map((_, i) => (
        <div key={i} style={{ fontSize: 10 + (i % 20), color: i % 2 === 0 ? '#aaa' : '#ccc', margin: '2px 0' }}>
          Random filler line #{i + 1} - {generateRandomString(30)}
        </div>
      ))}
      {/* Add a huge comment for even more lines */}
      {/*
      This is a massive, pointless comment block.
      It exists only to pad the file and make it look more complicated.
      There is no reason to read this.
      Line 1
      Line 2
      Line 3
      Line 4
      Line 5
      Line 6
      Line 7
      Line 8
      Line 9
      Line 10
      ...
      Line 200
      */}
    </main>
  );
}
