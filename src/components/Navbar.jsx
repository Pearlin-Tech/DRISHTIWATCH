import React, { useState, useEffect } from 'react';
import { User, Menu, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import './Navbar.css';

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`navbar ${isScrolled ? 'scrolled glass-panel' : ''}`}>
      <div className="navbar-container">
        <div className="navbar-brand">
          <span className="brand-sat">SATQUERY</span>
          <span className="brand-ai">AI</span>
        </div>
        
        <div className="navbar-center hide-mobile">
          <Link to="/explore" className="nav-link">Explore</Link>
          <a href="#ask" className="nav-link">Ask</a>
          <a href="#compare" className="nav-link">Compare</a>
          <a href="#watch" className="nav-link">Watch</a>
        </div>
        
        <div className="navbar-right hide-mobile">
          <button className="btn-secondary">Open Analyst</button>
          <button className="profile-btn">
            <User size={20} />
          </button>
        </div>

        <button 
          className="mobile-menu-btn hide-desktop"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {isMobileMenuOpen && (
        <div className="mobile-menu glass-panel">
          <Link to="/explore" className="nav-link">Explore</Link>
          <a href="#ask" className="nav-link">Ask</a>
          <a href="#compare" className="nav-link">Compare</a>
          <a href="#watch" className="nav-link">Watch</a>
          <button className="btn-secondary mt-4">Open Analyst</button>
        </div>
      )}
    </nav>
  );
}
