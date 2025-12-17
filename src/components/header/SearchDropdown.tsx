import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import api from "../../services/api";
import { useData } from "../../context/DataContext";

interface SearchResult {
  type: "product" | "sale" | "purchase" | "expense" | "customer" | "user";
  id: string;
  title: string;
  subtitle?: string;
  url: string;
}

interface SearchDropdownProps {
  query: string;
  onClose: () => void;
}

const getTypeIcon = (type: string) => {
  switch (type) {
    case "product":
      return "📦";
    case "sale":
      return "💰";
    case "purchase":
      return "🛒";
    case "expense":
      return "💸";
    case "user":
      return "👤";
    default:
      return "📄";
  }
};

const getTypeLabel = (type: string) => {
  switch (type) {
    case "product":
      return "Products";
    case "sale":
      return "Sales";
    case "purchase":
      return "Purchases";
    case "expense":
      return "Expenses";
    case "user":
      return "Users";
    default:
      return "Other";
  }
};

export default function SearchDropdown({ query, onClose }: SearchDropdownProps) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { currentUser } = useData();

  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setResults([]);
      return;
    }

    const search = async () => {
      setLoading(true);
      try {
        const data = await api.globalSearch(query);
        setResults(data.results || []);
        setSelectedIndex(0);
      } catch (error) {
        console.error("Search error:", error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(search, 300); // Debounce
    return () => clearTimeout(timeoutId);
  }, [query]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const handleResultClick = (result: SearchResult) => {
    navigate(result.url);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      e.preventDefault();
      handleResultClick(results[selectedIndex]);
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  if (!query || query.trim().length < 2) {
    return null;
  }

  // Group results by type
  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.type]) {
      acc[result.type] = [];
    }
    acc[result.type].push(result);
    return acc;
  }, {} as Record<string, SearchResult[]>);

  return (
    <div
      ref={dropdownRef}
      className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 dark:bg-gray-800 dark:border-gray-700 z-50 max-h-96 overflow-y-auto"
      onKeyDown={handleKeyDown}
    >
      {loading ? (
        <div className="p-4 text-center text-gray-500 dark:text-gray-400">
          Searching...
        </div>
      ) : results.length === 0 ? (
        <div className="p-4 text-center text-gray-500 dark:text-gray-400">
          No results found
        </div>
      ) : (
        <div className="py-2">
          {Object.entries(groupedResults).map(([type, typeResults]) => (
            <div key={type} className="mb-2">
              <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                {getTypeLabel(type)}
              </div>
              {typeResults.map((result, index) => {
                const globalIndex = results.indexOf(result);
                return (
                  <button
                    key={result.id}
                    onClick={() => handleResultClick(result)}
                    className={`w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                      selectedIndex === globalIndex
                        ? "bg-gray-50 dark:bg-gray-700"
                        : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-lg">{getTypeIcon(result.type)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 dark:text-white truncate">
                          {result.title}
                        </div>
                        {result.subtitle && (
                          <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                            {result.subtitle}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}






