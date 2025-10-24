// You need to install these: `npm install react-markdown remark-gfm date-fns gray-matter react-syntax-highlighter`
import React, { useState, useContext, useEffect, useMemo, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { format } from 'date-fns';
import matter from 'gray-matter';

import { Post, FrontMatter } from '../types';
import { AppContext } from '../App';
import { createOrUpdatePost, uploadImage } from '../services/githubService';
import { performAiAction, generateFrontMatter } from '../services/geminiService';
import Button from './ui/Button';
import Input from './ui/Input';
import Spinner from './ui/Spinner';
import Card from './ui/Card';
import { BackIcon, SaveIcon, SparklesIcon, UploadIcon, DownloadIcon, HelpIcon, InfoIcon } from '../constants';
import useLocalStorage from '../hooks/useLocalStorage';
import useDebounce from '../hooks/useDebounce';
import ImageUploadModal from './ImageUploadModal';
import HelpModal from './HelpModal';
import EditorToolbar from './EditorToolbar';

interface EditorProps {
  post: Post | null;
  onBack: () => void;
}

export interface EditorHandles {
  saveDraft: () => void;
  publishPost: () => void;
}

const slugify = (text: string) =>
  text.toString().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
    
const blobToBase64 = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = error => reject(error);
});

const isFormEqual = (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b);

const getInitialState = (post: Post | null) => ({
  title: post?.frontMatter.title || '',
  description: post?.frontMatter.description || '',
  categories: post?.frontMatter.categories?.join(', ') || '',
  tags: post?.frontMatter.tags?.join(', ') || '',
  content: post?.content || '',
  date: post?.frontMatter.date
    ? format(new Date(post.frontMatter.date), 'yyyy-MM-dd')
    : format(new Date(), 'yyyy-MM-dd'),
});


const Editor = forwardRef<EditorHandles, EditorProps>(({ post, onBack }, ref) => {
  const { auth, setPosts, allTags } = useContext(AppContext);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const tagsInputRef = useRef<HTMLInputElement>(null);
  const contentTextAreaRef = useRef<HTMLTextAreaElement>(null);
  
  const initialState = useMemo(() => getInitialState(post), [post]);
  const [formState, setFormState] = useState(initialState);

  const [localDraft, setLocalDraft] = useLocalStorage<ReturnType<typeof getInitialState> | null>(`leakspanel-draft-${post?.path || 'new'}`, null);

  const [pastedImage, setPastedImage] = useState<File | null>(null);
  const [cursorPosition, setCursorPosition] = useState(0);
  
  const [isPublishing, setIsPublishing] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isFrontMatterAiLoading, setIsFrontMatterAiLoading] = useState(false);
  const [isHelpOpen, setHelpOpen] = useState(false);
  const [status, setStatus] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);

  const [isDirty, setIsDirty] = useState(false);
  const [editorWidth, setEditorWidth] = useLocalStorage('leakspanel-editor-width', 50);
  const isResizing = useRef(false);

  const debouncedFormState = useDebounce(formState, 1500);

  useEffect(() => {
    titleInputRef.current?.focus();
  }, []);

  useEffect(() => {
    setIsDirty(!isFormEqual(initialState, formState));
  }, [formState, initialState]);

  // Load draft from local storage on mount
  useEffect(() => {
    if (localDraft && !isFormEqual(localDraft, initialState)) {
      if (window.confirm("You have an unsaved draft for this post. Would you like to restore it?")) {
        setFormState(localDraft);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave to local storage
  useEffect(() => {
    if (isDirty) {
        setLocalDraft(debouncedFormState);
    }
  }, [debouncedFormState, isDirty, setLocalDraft]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isDirty) {
        event.preventDefault();
        event.returnValue = ''; // Required for Chrome
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty]);

  // Paste image listener
  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
        const textarea = contentTextAreaRef.current;
        if (!textarea || document.activeElement !== textarea) return;

        const items = event.clipboardData?.items;
        if (!items) return;

        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const file = items[i].getAsFile();
                if (file) {
                    event.preventDefault();
                    setCursorPosition(textarea.selectionStart);
                    setPastedImage(file);
                    break;
                }
            }
        }
    };

    const textarea = contentTextAreaRef.current;
    textarea?.addEventListener('paste', handlePaste);
    return () => {
        textarea?.removeEventListener('paste', handlePaste);
    };
  }, []);
  
  useImperativeHandle(ref, () => ({
    saveDraft: () => handlePublish(false),
    publishPost: () => handlePublish(true),
  }));
  
  const handleMouseMove = useCallback((e: MouseEvent) => {
    // isResizing.current check is no longer needed here since the listener is only active during a drag.
    const parent = contentTextAreaRef.current?.parentElement?.parentElement?.parentElement;
    if (!parent) return;

    const bounds = parent.getBoundingClientRect();
    const newWidth = ((e.clientX - bounds.left) / bounds.width) * 100;
    const clampedWidth = Math.max(20, Math.min(80, newWidth));
    setEditorWidth(clampedWidth);
  }, [setEditorWidth]);

  const handleMouseUp = useCallback(() => {
    isResizing.current = false;
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove, handleMouseUp]);


  const wordCount = useMemo(() => formState.content.trim().split(/\s+/).filter(Boolean).length, [formState.content]);
  const charCount = useMemo(() => formState.content.length, [formState.content]);

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormState(prev => ({ ...prev, [name]: value }));
  };

  const handleTagChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormState(prev => ({ ...prev, tags: value }));

    const tagsArray = value.split(',').map(t => t.trim());
    const currentTag = tagsArray.pop()?.toLowerCase() || '';

    if (currentTag) {
      const existingTags = new Set(tagsArray.map(t => t.toLowerCase()));
      const matchingTags = allTags.filter(
        t => t.toLowerCase().startsWith(currentTag) && !existingTags.has(t.toLowerCase())
      );
      setTagSuggestions(matchingTags.slice(0, 5));
    } else {
      setTagSuggestions([]);
    }
  };

  const handleTagSuggestionClick = (tag: string) => {
    const tagsArray = formState.tags.split(',').map(t => t.trim());
    tagsArray.pop(); // remove the partial tag

    const tagExists = tagsArray.some(existingTag => existingTag.toLowerCase() === tag.toLowerCase());
    if (!tagExists) {
      tagsArray.push(tag);
    }

    setFormState(prev => ({ ...prev, tags: tagsArray.filter(Boolean).join(', ') + ', ' }));
    setTagSuggestions([]);
    tagsInputRef.current?.focus();
  };


  const handlePublish = async (published: boolean) => {
    if (!auth || !formState.title) {
      alert("Title is required.");
      return;
    }

    setIsPublishing(true);
    setStatus('Starting...');

    try {
      let effectiveDate = new Date(formState.date + 'T12:00:00');
      if (isNaN(effectiveDate.getTime())) {
          effectiveDate = new Date(); // Fallback to now
      }
      const frontMatterDate = effectiveDate.toISOString();
      
      const newFrontMatter: FrontMatter = {
        title: formState.title,
        description: formState.description,
        categories: formState.categories.split(',').map(c => c.trim()).filter(Boolean),
        tags: formState.tags.split(',').map(t => t.trim()).filter(Boolean),
        date: frontMatterDate,
        published,
        layout: 'post',
      };

      const newFileName = post?.fileName || `${format(effectiveDate, 'yyyy-MM-dd')}-${slugify(formState.title)}.md`;
      const newPath = `_posts/${newFileName}`;
      
      const newPost: Post = {
        sha: post?.path === newPath ? post.sha : undefined,
        fileName: newFileName,
        path: newPath,
        frontMatter: newFrontMatter,
        content: formState.content,
      };

      setStatus(published ? 'Publishing post...' : 'Saving draft...');
      const commitMessage = `${published ? 'feat' : 'draft'}: ${formState.title}`;
      await createOrUpdatePost(auth, newPost, commitMessage);
      
      setPosts(prevPosts => {
        const existingIndex = prevPosts.findIndex(p => p.path === post?.path);
        if (existingIndex > -1) {
            const updatedPosts = [...prevPosts];
            updatedPosts.splice(existingIndex, 1, newPost);
            return updatedPosts;
        }
        return [newPost, ...prevPosts].sort((a, b) => new Date(b.frontMatter.date).getTime() - new Date(a.frontMatter.date).getTime());
      });
      
      setLocalDraft(null); // Clear local draft on successful publish
      setStatus(published ? 'Published successfully!' : 'Draft saved!');
      setTimeout(() => onBack(), 1000);

    } catch (err) {
      console.error(err);
      setStatus(`Error: ${err instanceof Error ? err.message : 'An unknown error occurred'}`);
    } finally {
      setIsPublishing(false);
      setTimeout(() => setStatus(''), 5000);
    }
  };

  const handleImageUpload = async ({ file, alt, fullPath }: { file: Blob; alt: string; fullPath: string; }) => {
    if (!auth) return;

    setStatus('Uploading image...');
    try {
      const base64Content = await blobToBase64(file);
      await uploadImage(auth, fullPath, base64Content);
      
      const markdownToInsert = `![${alt}](/${fullPath})`;
      const newContent = 
        formState.content.slice(0, cursorPosition) +
        markdownToInsert +
        formState.content.slice(cursorPosition);
        
      setFormState(prev => ({...prev, content: newContent}));
      setStatus('Image inserted!');
    } catch (err) {
        console.error("Image upload failed:", err);
        setStatus('Image upload failed.');
    } finally {
        setPastedImage(null);
        setTimeout(() => setStatus(''), 3000);
    }
  };

  const handleAiAction = async (action: 'rephrase' | 'summarize' | 'expand' | 'tone-match') => {
      const selection = window.getSelection()?.toString() || formState.content;
      if (!selection) {
          alert("Please select text or write some content to use AI features.");
          return;
      }
      setIsAiLoading(true);
      try {
          const result = await performAiAction(action, selection);
          if (formState.content.includes(selection)) {
            setFormState(prev => ({...prev, content: prev.content.replace(selection, result)}));
          } else {
            setFormState(prev => ({...prev, content: prev.content + '\n\n' + result}));
          }
      } catch (err) {
          alert(`AI action failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
          setIsAiLoading(false);
      }
  };
  
  const handleGenerateFrontMatter = async () => {
    if (formState.content.trim().split(/\s+/).length < 50) {
        alert("Please write at least 50 words before generating front matter.");
        return;
    }
    setIsFrontMatterAiLoading(true);
    setStatus('Generating suggestions...');
    try {
        const result = await generateFrontMatter(formState.content);
        setFormState(prev => ({
            ...prev,
            title: result.title,
            description: result.description,
            tags: result.tags.join(', '),
        }));
        setStatus('AI suggestions applied!');
    } catch (err) {
        setStatus(`Error: ${err instanceof Error ? err.message : 'AI failed'}`);
    } finally {
        setIsFrontMatterAiLoading(false);
        setTimeout(() => setStatus(''), 3000);
    }
  };
  
  const handleExport = () => {
    if (!formState.title) {
        alert("Please set a title before exporting.");
        return;
    }
    const frontMatter = {
        title: formState.title,
        description: formState.description,
        categories: formState.categories.split(',').map(c => c.trim()).filter(Boolean),
        tags: formState.tags.split(',').map(t => t.trim()).filter(Boolean),
        date: format(new Date(formState.date + 'T12:00:00'), 'yyyy-MM-dd HH:mm:ss O'),
        published: false, // Default exported files to draft
        layout: 'post',
    };
    const fileContent = matter.stringify(formState.content, frontMatter);
    const blob = new Blob([fileContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${format(new Date(formState.date), 'yyyy-MM-dd')}-${slugify(formState.title)}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  
  const applyMarkdownFormatting = (prefix: string, suffix: string, type: 'inline' | 'block' | 'link' = 'inline') => {
    const textarea = contentTextAreaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    
    let newContent, selectionStart, selectionEnd;

    if (type === 'block') {
        const lineStart = textarea.value.lastIndexOf('\n', start - 1) + 1;
        const lineEnd = textarea.value.indexOf('\n', end);
        const effectiveEnd = lineEnd === -1 ? textarea.value.length : lineEnd;
        const selectedLines = textarea.value.substring(lineStart, effectiveEnd);
        
        const isAlreadyFormatted = selectedLines.split('\n').every(line => line.startsWith(prefix));
        const newLines = selectedLines.split('\n').map(line => 
            isAlreadyFormatted ? line.substring(prefix.length) : (line ? prefix + line : line)
        ).join('\n');
        
        newContent = textarea.value.substring(0, lineStart) + newLines + textarea.value.substring(effectiveEnd);
        selectionStart = lineStart;
        selectionEnd = lineStart + newLines.length;
    } else if (type === 'link') {
        const replacement = `[${selectedText || 'link text'}](${suffix || 'url'})`;
        newContent = textarea.value.substring(0, start) + replacement + textarea.value.substring(end);
        if (selectedText) {
            selectionStart = start + replacement.length - 4;
            selectionEnd = start + replacement.length - 1;
        } else {
            selectionStart = start + 1;
            selectionEnd = start + 10;
        }
    } else { // inline
        const replacement = prefix + selectedText + suffix;
        newContent = textarea.value.substring(0, start) + replacement + textarea.value.substring(end);
        if (selectedText) {
            selectionStart = start + prefix.length;
            selectionEnd = end + prefix.length;
        } else {
            selectionStart = start + prefix.length;
            selectionEnd = start + prefix.length;
        }
    }

    setFormState(prev => ({ ...prev, content: newContent }));
    setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(selectionStart, selectionEnd);
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.ctrlKey || e.metaKey) {
        let handled = true;
        if (e.shiftKey) {
            switch(e.key) {
                case 'C': applyMarkdownFormatting('```\n', '\n```', 'block'); break;
                case '.': applyMarkdownFormatting('> ', '', 'block'); break;
                case '7': applyMarkdownFormatting('1. ', '', 'block'); break;
                case '8': applyMarkdownFormatting('- ', '', 'block'); break;
                default: handled = false;
            }
        } else {
            switch (e.key) {
                case 'b': applyMarkdownFormatting('**', '**'); break;
                case 'i': applyMarkdownFormatting('*', '*'); break;
                case 'u': applyMarkdownFormatting('~~', '~~'); break;
                case 'l': applyMarkdownFormatting('[', '](url)', 'link'); break;
                case 'e': applyMarkdownFormatting('`', '`'); break;
                default: handled = false;
            }
        }

        if (handled) {
            e.preventDefault();
        }
    }
  };

  const postSlug = useMemo(() => slugify(formState.title) || 'untitled', [formState.title]);
  
  const markdownComponents: any = {
      code({node, inline, className, children, ...props}: any) {
        const match = /language-(\w+)/.exec(className || '');
        if (!inline && match) {
            return (
                <div className="code-block-wrapper my-4 rounded-lg overflow-hidden bg-[#2b2b2b]">
                    <div className="text-xs text-gray-400 bg-black/20 px-4 py-2 font-mono">{match[1]}</div>
                    <SyntaxHighlighter
                        style={vscDarkPlus}
                        language={match[1]}
                        PreTag="div"
                        {...props}
                        customStyle={{ margin: 0, padding: '1rem', backgroundColor: 'transparent' }}
                    >
                        {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                </div>
            )
        }
        return (
          <code className={className} {...props}>
            {children}
          </code>
        )
      },
      blockquote({node, children, ...props}: any) {
        return (
            <blockquote {...props} className="flex items-start gap-4 p-4 my-4 border-l-4 border-[#0288d1] bg-[#0288d1]/10 text-[#90caf9] rounded-r-lg">
                <InfoIcon className="w-5 h-5 flex-shrink-0 mt-1 text-[#0288d1]" />
                <div>{children}</div>
            </blockquote>
        )
      }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {pastedImage && (
        <ImageUploadModal 
            imageFile={pastedImage} 
            postSlug={postSlug}
            onClose={() => setPastedImage(null)}
            onUpload={handleImageUpload}
        />
      )}
      <HelpModal isOpen={isHelpOpen} onClose={() => setHelpOpen(false)} />
      <header className="flex items-center justify-between mb-4 pb-4 border-b border-gray-800">
        <div className="flex items-center gap-4">
            <Button onClick={onBack} variant="ghost" size="sm" className="p-2 h-auto" disabled={isPublishing}>
                <BackIcon className="w-5 h-5"/>
            </Button>
            <Input
              ref={titleInputRef}
              type="text"
              name="title"
              value={formState.title}
              onChange={handleFormChange}
              placeholder="Post Title..."
              className="text-2xl font-bold bg-transparent border-0 focus-visible:ring-0 p-0 h-auto"
            />
        </div>
        <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 mr-4 font-mono transition-opacity duration-300">{status}</span>
            {isPublishing && <Spinner className="w-5 h-5" />}
             <Button onClick={handleExport} variant="secondary" size="icon" title="Export as Markdown file" disabled={isPublishing}>
              <DownloadIcon className="w-4 h-4" />
            </Button>
            <Button onClick={() => handlePublish(false)} variant="secondary" disabled={isPublishing || !isDirty} className="gap-2">
              <SaveIcon className="w-4 h-4" /> Save Draft
            </Button>
            <Button onClick={() => handlePublish(true)} variant="primary" disabled={isPublishing || !isDirty} className="gap-2">
              <UploadIcon className="w-4 h-4" /> Publish
            </Button>
            <Button onClick={() => setHelpOpen(true)} variant="ghost" size="icon" title="Help & Shortcuts">
              <HelpIcon className="w-5 h-5" />
            </Button>
        </div>
      </header>
      
      <div className="mb-4 flex flex-col gap-4">
          <div className="relative border border-transparent hover:border-white/10 rounded-lg p-4 -m-4 group transition-colors">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                    <label htmlFor="editor-description" className="block text-sm font-medium text-gray-400 mb-1">Description</label>
                    <Input id="editor-description" name="description" value={formState.description} onChange={handleFormChange} placeholder="A short, catchy summary" />
                </div>
                <div>
                    <label htmlFor="editor-date" className="block text-sm font-medium text-gray-400 mb-1">Date</label>
                    <Input id="editor-date" type="date" name="date" value={formState.date} onChange={handleFormChange} />
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                    <label htmlFor="editor-categories" className="block text-sm font-medium text-gray-400 mb-1">Categories</label>
                    <Input id="editor-categories" name="categories" value={formState.categories} onChange={handleFormChange} placeholder="e.g., Tech, Life" />
                </div>
                <div className="relative">
                    <label htmlFor="editor-tags" className="block text-sm font-medium text-gray-400 mb-1">Tags</label>
                    <Input id="editor-tags" name="tags" ref={tagsInputRef} value={formState.tags} onChange={handleTagChange} placeholder="e.g., react, learning" autoComplete="off"/>
                    {tagSuggestions.length > 0 && (
                        <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-[#242424] border border-gray-700 rounded-md shadow-lg">
                            {tagSuggestions.map(tag => (
                                <button key={tag} onClick={() => handleTagSuggestionClick(tag)} className="block w-full text-left px-3 py-2 text-sm hover:bg-[#7f5af0]/20">
                                    {tag}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            <Button onClick={handleGenerateFrontMatter} variant="ghost" size="sm" className="absolute -top-3 -right-3 opacity-0 group-hover:opacity-100 transition-opacity gap-2 bg-[#242424]" disabled={isFrontMatterAiLoading}>
                {isFrontMatterAiLoading ? <Spinner className="w-4 h-4" /> : <SparklesIcon className="w-4 h-4 text-[#00ffae]" />}
                Generate with AI
            </Button>
          </div>
      </div>

      <div className="flex-grow min-h-0 flex" onMouseUp={handleMouseUp}>
        <div className="flex flex-col min-h-0" style={{ flexBasis: `${editorWidth}%`}}>
            <EditorToolbar onFormat={applyMarkdownFormatting} />
          <div className="relative flex-grow min-h-0">
            <textarea
              id="editor-content"
              ref={contentTextAreaRef}
              name="content"
              value={formState.content}
              onChange={handleFormChange}
              onKeyDown={handleKeyDown}
              placeholder="Start writing your mind leak here... Copy-paste images to upload."
              className="w-full h-full rounded-md border-t-0 rounded-t-none border border-gray-700 bg-transparent p-4 font-mono text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7f5af0]"
            />
             <div className="absolute bottom-2 right-2 flex items-center gap-4 text-xs font-mono text-gray-500">
                {isAiLoading && <Spinner className="w-4 h-4 text-[#00ffae]"/>}
                <div className="group relative">
                    <Button variant="ghost" size="sm" className="p-1 h-auto" disabled={isAiLoading}>
                        <SparklesIcon className="w-5 h-5 text-gray-400 group-hover:text-[#00ffae]"/>
                    </Button>
                    <div className="absolute bottom-full right-0 mb-2 hidden group-hover:flex flex-col items-stretch gap-1 bg-[#242424] border border-gray-700 rounded-md p-1 shadow-lg w-32 z-10">
                        <button onClick={() => handleAiAction('rephrase')} className="text-left text-sm px-2 py-1 hover:bg-[#7f5af0]/20 rounded">Rephrase</button>
                        <button onClick={() => handleAiAction('summarize')} className="text-left text-sm px-2 py-1 hover:bg-[#7f5af0]/20 rounded">Summarize</button>
                        <button onClick={() => handleAiAction('expand')} className="text-left text-sm px-2 py-1 hover:bg-[#7f5af0]/20 rounded">Expand</button>
                        <button onClick={() => handleAiAction('tone-match')} className="text-left text-sm px-2 py-1 hover:bg-[#7f5af0]/20 rounded">Tone Match</button>
                    </div>
                </div>
                <span>{wordCount} words</span>
                <span>{charCount} chars</span>
            </div>
          </div>
        </div>

        <div onMouseDown={handleMouseDown} className="w-2.5 flex-shrink-0 cursor-col-resize flex items-center justify-center group">
            <div className="w-1 h-10 bg-gray-800 group-hover:bg-[#7f5af0] rounded-full transition-colors duration-200"></div>
        </div>

        <div className="bg-[#28282b] rounded-lg overflow-y-auto" style={{ flexBasis: `${100 - editorWidth}%`}}>
          <article className="prose prose-invert prose-base max-w-none p-8 
            prose-headings:text-[#dedede] prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl
            prose-p:text-[#b5b5b5] prose-p:leading-relaxed
            prose-a:text-[#7f5af0] hover:prose-a:underline prose-a:no-underline
            prose-strong:text-gray-100
            prose-hr:border-gray-700
            prose-ul:text-[#b5b5b5] prose-ol:text-[#b5b5b5]
            prose-li:marker:text-gray-500
            prose-table:w-full prose-table:border-collapse
            prose-thead:border-b-2 prose-thead:border-gray-600
            prose-th:px-4 prose-th:py-2 prose-th:text-left prose-th:font-semibold prose-th:text-[#dedede]
            prose-tbody:divide-y prose-tbody:divide-gray-700
            prose-tr:even:bg-white/5
            prose-td:px-4 prose-td:py-2
            prose-code:bg-white/10 prose-code:text-[#b5b5b5] prose-code:px-1.5 prose-code:py-1 prose-code:rounded-md prose-code:font-mono prose-code:font-normal prose-code:before:content-[''] prose-code:after:content-['']
            prose-pre:bg-transparent prose-pre:p-0
            prose-blockquote:hidden"
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {`# ${formState.title || 'Untitled Post'}\n\n${formState.content}`}
            </ReactMarkdown>
          </article>
        </div>
      </div>
    </div>
  );
});

export default Editor;