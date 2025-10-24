import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { AuthDetails, Post } from './types';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Editor, { EditorHandles } from './components/Editor';
import { GithubIcon, PlusIcon, SaveIcon, UploadIcon, BackIcon, LogoutIcon } from './constants';
import useLocalStorage from './hooks/useLocalStorage';
import CommandPalette from './components/CommandPalette';

export interface Command {
  id: string;
  name: string;
  action: () => void;
  icon: React.ReactNode;
  section: string;
}

export const AppContext = React.createContext<{
  auth: AuthDetails | null;
  setAuth: (auth: AuthDetails | null) => void;
  posts: Post[];
  setPosts: (posts: Post[]) => void;
  logout: () => void;
  allTags: string[];
  authError: string | null;
  setAuthError: (error: string | null) => void;
  openCommandPalette: () => void;
}>({
  auth: null,
  setAuth: () => {},
  posts: [],
  setPosts: () => {},
  logout: () => {},
  allTags: [],
  authError: null,
  setAuthError: () => {},
  openCommandPalette: () => {},
});

const App: React.FC = () => {
  const [storedAuth, setStoredAuth] = useLocalStorage<AuthDetails | null>('leakspanel-auth', null);
  const [auth, setAuth] = useState<AuthDetails | null>(storedAuth);
  const [posts, setPosts] = useState<Post[]>([]);
  const [currentView, setCurrentView] = useState<'dashboard' | 'editor'>('dashboard');
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isCommandPaletteOpen, setCommandPaletteOpen] = useState(false);
  
  const editorRef = useRef<EditorHandles>(null);

  useEffect(() => {
    setAuth(storedAuth);
  }, [storedAuth]);
  
  // Command Palette listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(isOpen => !isOpen);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);


  const allTags = useMemo(() => {
    const tags = new Set<string>();
    posts.forEach(post => {
      post.frontMatter.tags?.forEach(tag => tags.add(tag));
    });
    return Array.from(tags).sort();
  }, [posts]);

  const handleSetAuth = (newAuth: AuthDetails | null) => {
    setAuth(newAuth);
    setStoredAuth(newAuth);
    if (newAuth) {
      setAuthError(null);
    }
  };
  
  const logout = useCallback(() => {
    handleSetAuth(null);
    setPosts([]);
    setCurrentView('dashboard');
    setEditingPost(null);
    setAuthError(null);
  }, []);

  const handleNewPost = useCallback(() => {
    setEditingPost(null);
    setCurrentView('editor');
  }, []);

  const handleEditPost = (post: Post) => {
    setEditingPost(post);
    setCurrentView('editor');
  };

  const handleBackToDashboard = useCallback(() => {
    setEditingPost(null);
    setCurrentView('dashboard');
  }, []);

  const commands: Command[] = useMemo(() => {
    const commandList: Command[] = [];

    if (currentView === 'editor') {
        commandList.push(
            { id: 'save', name: 'Save Draft', action: () => editorRef.current?.saveDraft(), icon: <SaveIcon className="w-4 h-4"/>, section: 'Editor' },
            { id: 'publish', name: 'Publish Post', action: () => editorRef.current?.publishPost(), icon: <UploadIcon className="w-4 h-4"/>, section: 'Editor' }
        );
    }
    
    // Navigation
    if (currentView === 'editor') {
        commandList.push({ id: 'dashboard', name: 'Go to Dashboard', action: handleBackToDashboard, icon: <BackIcon className="w-4 h-4" />, section: 'Navigation' });
    }
    if (currentView === 'dashboard') {
        commandList.push({ id: 'new_post', name: 'Create New Post', action: handleNewPost, icon: <PlusIcon className="w-4 h-4" />, section: 'Navigation' });
    }
    
    // General
    commandList.push({ id: 'logout', name: 'Logout', action: logout, icon: <LogoutIcon className="w-4 h-4" />, section: 'General' });

    return commandList;
  }, [currentView, handleNewPost, handleBackToDashboard, logout]);
  
  if (!auth) {
    return <Login setAuth={handleSetAuth} initialError={authError} />;
  }

  return (
    <AppContext.Provider value={{ auth, setAuth: handleSetAuth, posts, setPosts, logout, allTags, authError, setAuthError, openCommandPalette: () => setCommandPaletteOpen(true) }}>
      <div className="min-h-screen bg-[#0f0f0f] text-gray-200">
        <main className="p-4 sm:p-6 lg:p-8">
            {currentView === 'dashboard' && <Dashboard onNewPost={handleNewPost} onEditPost={handleEditPost} />}
            {currentView === 'editor' && <Editor ref={editorRef} post={editingPost} onBack={handleBackToDashboard} />}
        </main>
        <footer className="fixed bottom-4 right-4 text-xs text-gray-500 flex items-center gap-2">
            LeaksPanel
            <a href="https://github.com/lavsarkari/leaks" target="_blank" rel="noopener noreferrer" className="hover:text-[#7f5af0] transition-colors">
                <GithubIcon className="w-4 h-4" />
            </a>
        </footer>
        <CommandPalette
            isOpen={isCommandPaletteOpen}
            onClose={() => setCommandPaletteOpen(false)}
            commands={commands}
        />
      </div>
    </AppContext.Provider>
  );
};

export default App;