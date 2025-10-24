import React, { useEffect } from 'react';
import Button from './ui/Button';
import Card from './ui/Card';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const Shortcut: React.FC<{ keys: string; description: string }> = ({ keys, description }) => (
    <div className="flex justify-between items-center py-2 border-b border-white/10">
        <span className="text-gray-300">{description}</span>
        <kbd className="font-mono text-sm bg-white/10 text-gray-400 px-2 py-1 rounded-md">{keys}</kbd>
    </div>
);

const shortcuts = {
    "Application": [
        { keys: 'Cmd/Ctrl + K', description: 'Open Command Palette' },
    ],
    "Formatting": [
        { keys: 'Cmd/Ctrl + B', description: 'Bold' },
        { keys: 'Cmd/Ctrl + I', description: 'Italic' },
        { keys: 'Cmd/Ctrl + U', description: 'Strikethrough' },
        { keys: 'Cmd/Ctrl + L', description: 'Insert Link' },
        { keys: 'Cmd/Ctrl + E', description: 'Inline Code' },
    ],
    "Block Elements": [
        { keys: 'Cmd/Ctrl + Shift + C', description: 'Code Block' },
        { keys: 'Cmd/Ctrl + Shift + .', description: 'Blockquote' },
        { keys: 'Cmd/Ctrl + Shift + 8', description: 'Bulleted List' },
        { keys: 'Cmd/Ctrl + Shift + 7', description: 'Numbered List' },
    ],
};

const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <Card className="w-full max-w-lg max-h-[80vh] flex flex-col p-6" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold mb-4">Keyboard Shortcuts</h2>
                <div className="flex-grow overflow-y-auto pr-4 -mr-4 text-sm">
                    {Object.entries(shortcuts).map(([section, shortcutsInSection]) => (
                        <div key={section} className="mb-4">
                            <h3 className="font-semibold text-gray-400 mb-2">{section}</h3>
                            {shortcutsInSection.map(sc => <Shortcut key={sc.keys} {...sc} />)}
                        </div>
                    ))}
                </div>
                <div className="flex justify-end mt-6">
                    <Button onClick={onClose}>Close</Button>
                </div>
            </Card>
        </div>
    );
};

export default HelpModal;