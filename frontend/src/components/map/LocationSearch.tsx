/**
 * LocationSearch Component
 * 
 * Search bar for finding and navigating to locations.
 * Features:
 * - Autocomplete suggestions
 * - Recent searches
 * - Click to navigate
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, MapPin, Clock, X } from 'lucide-react';
import { useTrafficStore } from '../../stores/trafficStore';
import { trafficApi } from '../../services/api';
import type { LocationResult } from '../../types/traffic';

const RECENT_SEARCHES_KEY = 'traffic-recent-searches';
const MAX_RECENT_SEARCHES = 5;

export function LocationSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LocationResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const inputRef = useRef<HTMLInputElement>(null);
  const setMapView = useTrafficStore((s) => s.setMapView);

  // Load recent searches from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (stored) {
      try {
        setRecentSearches(JSON.parse(stored));
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.trim().length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await trafficApi.searchLocation(query.trim(), 8);
        setResults(response.results);
      } catch (err) {
        console.error('Search failed:', err);
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300); // 300ms debounce

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query]);

  const handleSelectLocation = useCallback((location: LocationResult) => {
    // Navigate to location
    setMapView({
      center: location.coordinates,
      zoom: 13, // Good zoom level for city view
      bounds: location.bounds,
    });

    // Add to recent searches
    const newRecent = [location.name, ...recentSearches.filter(s => s !== location.name)].slice(0, MAX_RECENT_SEARCHES);
    setRecentSearches(newRecent);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(newRecent));

    // Clear search
    setQuery('');
    setResults([]);
    setShowResults(false);
  }, [setMapView, recentSearches]);

  const handleRecentClick = useCallback((search: string) => {
    setQuery(search);
    inputRef.current?.focus();
  }, []);

  const clearRecent = useCallback(() => {
    setRecentSearches([]);
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  }, []);

  return (
    <div className="relative w-full max-w-md">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dash-muted" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowResults(true);
          }}
          onFocus={() => setShowResults(true)}
          onBlur={() => {
            // Delay hiding to allow clicks
            setTimeout(() => setShowResults(false), 200);
          }}
          placeholder="Search for a location..."
          className="w-full pl-10 pr-10 py-2 bg-dash-card border border-dash-border rounded-lg text-dash-text placeholder-dash-muted focus:outline-none focus:ring-2 focus:ring-dash-accent focus:border-transparent"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setResults([]);
              inputRef.current?.focus();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-dash-muted hover:text-dash-text"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Results Dropdown */}
      {showResults && (results.length > 0 || recentSearches.length > 0 || isSearching) && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-dash-card border border-dash-border rounded-lg shadow-lg z-[2000] max-h-96 overflow-y-auto">
          {/* Recent Searches */}
          {!query && recentSearches.length > 0 && (
            <div className="p-2 border-b border-dash-border">
              <div className="flex items-center justify-between px-2 py-1 mb-1">
                <div className="flex items-center gap-2 text-xs text-dash-muted">
                  <Clock className="w-3 h-3" />
                  <span>Recent</span>
                </div>
                <button
                  onClick={clearRecent}
                  className="text-xs text-dash-muted hover:text-dash-text"
                >
                  Clear
                </button>
              </div>
              {recentSearches.map((search, idx) => (
                <button
                  key={idx}
                  onClick={() => handleRecentClick(search)}
                  className="w-full text-left px-3 py-2 hover:bg-dash-border rounded text-sm text-dash-text flex items-center gap-2"
                >
                  <Clock className="w-4 h-4 text-dash-muted" />
                  {search}
                </button>
              ))}
            </div>
          )}

          {/* Search Results */}
          {query && (
            <>
              {isSearching ? (
                <div className="p-4 text-center text-dash-muted text-sm">
                  Searching...
                </div>
              ) : results.length > 0 ? (
                <div className="p-2">
                  {results.map((result, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelectLocation(result)}
                      className="w-full text-left px-3 py-2 hover:bg-dash-border rounded text-sm"
                    >
                      <div className="flex items-start gap-3">
                        <MapPin className="w-4 h-4 text-dash-accent mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-dash-text font-medium truncate">
                            {result.name}
                          </div>
                          {result.address && (
                            <div className="text-dash-muted text-xs truncate mt-0.5">
                              {result.address}
                            </div>
                          )}
                          <div className="text-dash-muted text-xs mt-0.5 capitalize">
                            {result.type}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-dash-muted text-sm">
                  No results found
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

