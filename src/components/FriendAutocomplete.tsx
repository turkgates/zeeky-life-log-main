import { useState, useEffect, useRef } from 'react';
import { searchFriends, addFriend } from '@/lib/friendsSupabase';

type SuggestionRow = { id: string; name: string; nickname?: string | null; relationship?: string | null };

interface Props {
  userId: string;
  value: string[];
  onChange: (people: string[]) => void;
  placeholder?: string;
}

export function FriendAutocomplete({ userId, value, onChange, placeholder }: Props) {
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<SuggestionRow[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (input.length < 1) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      if (!userId) return;
      const results = await searchFriends(userId, input);
      setSuggestions(results as SuggestionRow[]);
      setShowDropdown(true);
    }, 300);
    return () => clearTimeout(timer);
  }, [input, userId]);

  const addPerson = async (name: string) => {
    if (!name.trim() || value.includes(name)) return;

    const exists = suggestions.find(
      s => s.name.toLowerCase() === name.toLowerCase(),
    );
    if (!exists && userId) {
      await addFriend(userId, { name: name.trim(), source: 'manual' });
    }

    onChange([...value, name.trim()]);
    setInput('');
    setSuggestions([]);
    setShowDropdown(false);
  };

  const removePerson = (name: string) => {
    onChange(value.filter(p => p !== name));
  };

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-2 mb-2">
        {value.map(person => (
          <span
            key={person}
            className="flex items-center gap-1 bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm"
          >
            {person}
            <button
              type="button"
              onClick={() => removePerson(person)}
              className="text-blue-400 hover:text-blue-700 ml-1"
            >
              ×
            </button>
          </span>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && input.trim()) {
              e.preventDefault();
              void addPerson(input.trim());
            }
          }}
          placeholder={placeholder || 'Kişi ekle...'}
          className="flex-1 border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
        />
        <button
          type="button"
          onClick={() => input.trim() && void addPerson(input.trim())}
          className="px-3 py-2 bg-blue-600 text-white rounded-xl text-sm"
        >
          Ekle
        </button>
      </div>

      {showDropdown && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {suggestions.map(friend => (
            <button
              key={friend.id}
              type="button"
              onClick={() => void addPerson(friend.name)}
              className="w-full px-4 py-3 text-left text-sm hover:bg-blue-50 flex items-center gap-2"
            >
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                {friend.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-medium">{friend.name}</p>
                {friend.nickname && (
                  <p className="text-gray-400 text-xs">{friend.nickname}</p>
                )}
              </div>
            </button>
          ))}
          {!suggestions.find(s => s.name.toLowerCase() === input.toLowerCase()) && input.trim() && (
            <button
              type="button"
              onClick={() => void addPerson(input.trim())}
              className="w-full px-4 py-3 text-left text-sm hover:bg-green-50 flex items-center gap-2 border-t border-gray-100"
            >
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                +
              </div>
              <p className="text-green-600">&quot;{input}&quot; ekle</p>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
