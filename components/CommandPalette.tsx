import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Command } from '../App';
import Card from './ui/Card';
import { SearchIcon, CommandIcon } from '../constants';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: Command[];
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, commands }) => {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const filteredCommands = useMemo(() => {
    if (!search) return commands;
    return commands.filter(cmd => cmd.name.toLowerCase().includes(search.toLowerCase()));
  }, [search, commands]);

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredCommands.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const command = filteredCommands[selectedIndex];
        if (command) {
          command.action();
          onClose();
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, filteredCommands, selectedIndex]);
  
  useEffect(() => {
    resultsRef.current?.children[selectedIndex]?.scrollIntoView({
        block: 'nearest'
    })
  }, [selectedIndex]);

  if (!isOpen) return null;

  const groupedCommands = useMemo(() => {
    // Fix: Explicitly provide the generic type argument to `reduce` to ensure TypeScript correctly infers the return type.
    return filteredCommands.reduce<Record<string, Command[]>>((acc, command) => {
      (acc[command.section] = acc[command.section] || []).push(command);
      return acc;
    }, {});
  }, [filteredCommands]);

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex justify-center pt-[20vh]" onClick={onClose}>
      <Card className="w-full max-w-xl h-fit max-h-[60vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-white/10 p-4">
          <SearchIcon className="w-5 h-5 text-gray-500" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setSelectedIndex(0); }}
            placeholder="Type a command or search..."
            className="w-full bg-transparent text-gray-200 placeholder:text-gray-500 focus:outline-none"
          />
        </div>
        <div ref={resultsRef} className="overflow-y-auto p-2">
            {Object.keys(groupedCommands).length > 0 ? (
// Fix: Use Object.keys for more type-safe iteration over grouped commands, preventing a 'map' of 'unknown' error.
                Object.keys(groupedCommands).map((section) => (
                    <div key={section}>
                        <h3 className="text-xs font-semibold text-gray-400 px-2 py-1">{section}</h3>
                        {groupedCommands[section].map((cmd) => {
                             const isSelected = filteredCommands[selectedIndex]?.id === cmd.id;
                             return (
                                <button
                                    key={cmd.id}
                                    onClick={() => { cmd.action(); onClose(); }}
                                    className={`w-full text-left flex items-center justify-between gap-2 px-3 py-2 rounded-md text-sm ${isSelected ? 'bg-[#7f5af0]/30 text-white' : 'text-gray-300 hover:bg-white/5'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        {cmd.icon}
                                        <span>{cmd.name}</span>
                                    </div>
                                </button>
                             )
                        })}
                    </div>
                ))
            ) : (
                <p className="text-center text-sm text-gray-500 p-8">No results found.</p>
            )}
        </div>
        <div className="border-t border-white/10 p-2 text-xs text-gray-500 flex items-center justify-end gap-4">
            <span><kbd className="font-sans bg-white/10 px-1.5 py-0.5 rounded">↑</kbd> <kbd className="font-sans bg-white/10 px-1.5 py-0.5 rounded">↓</kbd> to navigate</span>
            <span><kbd className="font-sans bg-white/10 px-1.5 py-0.5 rounded">Enter</kbd> to select</span>
            <span><kbd className="font-sans bg-white/10 px-1.5 py-0.5 rounded">Esc</kbd> to close</span>
        </div>
      </Card>
    </div>
  );
};

export default CommandPalette;