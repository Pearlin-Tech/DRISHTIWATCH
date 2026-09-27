import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Explore from './pages/Explore/Explore';
import Ask from './pages/Ask/Ask';
import Detect from './pages/Detect/Detect';
import Compare from './pages/Compare/Compare';
import Measure from './pages/Measure/Measure';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/ask" element={<Ask />} />
        <Route path="/detect" element={<Detect />} />
        <Route path="/compare" element={<Compare />} />
        <Route path="/measure" element={<Measure />} />
      </Routes>
    </Router>
  );
}

export default App;
