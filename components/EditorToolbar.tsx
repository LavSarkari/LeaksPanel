import React from 'react';
import {
  HeadingIcon, BoldIcon, ItalicIcon, StrikethroughIcon, LinkIcon, CodeIcon, QuoteIcon, ListIcon, ListOrderedIcon
} from '../constants';

type ApplyFormat = (prefix: string, suffix: string, type?: 'inline' | 'block' | 'link') => void;

interface EditorToolbarProps {
  onFormat: ApplyFormat;
}

const ToolbarButton: React.FC<{ onClick: () => void; title: string; children: React.ReactNode }> = ({ onClick, title, children }) => (
  <button
    onClick={onClick}
    title={title}
    className="p-2 rounded-md hover:bg-white/10 transition-colors"
  >
    {children}
  </button>
);

const EditorToolbar: React.FC<EditorToolbarProps> = ({ onFormat }) => {
  return (
    <div className="flex items-center gap-1 p-1 border border-gray-700 bg-[#1a1a1a] rounded-t-md border-b-0">
      <div className="group relative">
        <ToolbarButton onClick={() => {}} title="Headings">
            <HeadingIcon className="w-5 h-5" />
        </ToolbarButton>
        <div className="absolute top-full left-0 mt-1 hidden group-hover:flex flex-col items-stretch gap-1 bg-[#242424] border border-gray-700 rounded-md p-1 shadow-lg w-32 z-10">
            <button onClick={() => onFormat('# ', '', 'block')} className="text-left text-sm px-2 py-1 hover:bg-[#7f5af0]/20 rounded">Heading 1</button>
            <button onClick={() => onFormat('## ', '', 'block')} className="text-left text-sm px-2 py-1 hover:bg-[#7f5af0]/20 rounded">Heading 2</button>
            <button onClick={() => onFormat('### ', '', 'block')} className="text-left text-sm px-2 py-1 hover:bg-[#7f5af0]/20 rounded">Heading 3</button>
        </div>
      </div>

      <div className="w-px h-6 bg-gray-700 mx-1" />

      <ToolbarButton onClick={() => onFormat('**', '**')} title="Bold (Cmd+B)">
        <BoldIcon className="w-5 h-5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => onFormat('*', '*')} title="Italic (Cmd+I)">
        <ItalicIcon className="w-5 h-5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => onFormat('~~', '~~')} title="Strikethrough (Cmd+U)">
        <StrikethroughIcon className="w-5 h-5" />
      </ToolbarButton>

      <div className="w-px h-6 bg-gray-700 mx-1" />

      <ToolbarButton onClick={() => onFormat('[', '](url)', 'link')} title="Insert Link (Cmd+L)">
        <LinkIcon className="w-5 h-5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => onFormat('`', '`')} title="Inline Code (Cmd+E)">
        <CodeIcon className="w-5 h-5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => onFormat('> ', '', 'block')} title="Blockquote (Cmd+Shift+.)">
        <QuoteIcon className="w-5 h-5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => onFormat('```\n', '\n```', 'block')} title="Code Block (Cmd+Shift+C)">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M10 9.5 8 12l2 2.5"/><path d="m14 9.5 2 2.5-2 2.5"/><path d="M2 12h20"/></svg>
      </ToolbarButton>

      <div className="w-px h-6 bg-gray-700 mx-1" />

      <ToolbarButton onClick={() => onFormat('- ', '', 'block')} title="Bulleted List (Cmd+Shift+8)">
        <ListIcon className="w-5 h-5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => onFormat('1. ', '', 'block')} title="Numbered List (Cmd+Shift+7)">
        <ListOrderedIcon className="w-5 h-5" />
      </ToolbarButton>
    </div>
  );
};

export default EditorToolbar;