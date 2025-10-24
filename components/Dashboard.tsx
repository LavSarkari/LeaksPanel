import React, { useState, useEffect, useContext, useMemo } from 'react';
import { getPosts, deletePost } from '../services/githubService';
import { Post } from '../types';
import { AppContext } from '../App';
import Button from './ui/Button';
import Card from './ui/Card';
import Spinner from './ui/Spinner';
import Input from './ui/Input';
import { PlusIcon, EditIcon, TrashIcon, LogoutIcon, SearchIcon } from '../constants';
// You might need to install this: `npm install date-fns`
import { format } from 'date-fns';

interface DashboardProps {
  onNewPost: () => void;
  onEditPost: (post: Post) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onNewPost, onEditPost }) => {
  const { auth, posts, setPosts, logout, setAuthError } = useContext(AppContext);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'published' | 'drafts'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchPosts = async () => {
      if (!auth) return;
      setLoading(true);
      setError(null);
      try {
        const fetchedPosts = await getPosts(auth);
        setPosts(fetchedPosts);
      } catch (err: any) {
        if (err && err.status === 401) {
          setAuthError("Bad credentials. Your GitHub token is invalid or has expired. Please log in again.");
          logout();
        } else {
          setError('Failed to fetch posts. Check your connection and repository details.');
          console.error(err);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth, setPosts, logout, setAuthError]);
  
  const handleDelete = async (post: Post) => {
    if (window.confirm(`Are you sure you want to delete "${post.frontMatter.title}"?`)) {
      if (!auth) return;
      try {
        await deletePost(auth, post);
        setPosts(posts.filter(p => p.path !== post.path));
      } catch (err) {
        alert('Failed to delete post.');
        console.error(err);
      }
    }
  };

  const filteredPosts = useMemo(() => {
    let tempPosts = posts;

    if (filter === 'published') {
      tempPosts = posts.filter(p => p.frontMatter.published);
    } else if (filter === 'drafts') {
      tempPosts = posts.filter(p => !p.frontMatter.published);
    }

    if (!searchQuery) {
      return tempPosts;
    }

    const lowercasedQuery = searchQuery.toLowerCase();

    return tempPosts.filter(post => {
      const titleMatch = post.frontMatter.title.toLowerCase().includes(lowercasedQuery);
      const descriptionMatch = post.frontMatter.description.toLowerCase().includes(lowercasedQuery);
      const tagsMatch = post.frontMatter.tags.some(tag => tag.toLowerCase().includes(lowercasedQuery));
      return titleMatch || descriptionMatch || tagsMatch;
    });
  }, [posts, filter, searchQuery]);

  return (
    <div className="max-w-7xl mx-auto">
      <header className="flex flex-col sm:flex-row items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">LeaksPanel Dashboard</h1>
          <p className="text-gray-400">Manage your mind leaks.</p>
        </div>
        <div className="flex items-center gap-2">
           <Button onClick={onNewPost} variant="primary" className="gap-2">
            <PlusIcon className="w-5 h-5" />
            New Post
          </Button>
          <Button onClick={logout} variant="ghost" size="sm" className="p-2 h-auto">
              <LogoutIcon className="w-5 h-5 text-gray-400" />
          </Button>
        </div>
      </header>

      <div className="mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 border-b border-gray-800 sm:border-b-0 self-start sm:self-center">
          {(['all', 'published', 'drafts'] as const).map(f => (
            <button 
              key={f} 
              onClick={() => setFilter(f)} 
              className={`capitalize px-3 py-2 text-sm font-medium transition-colors ${filter === f ? 'text-[#7f5af0] border-b-2 border-[#7f5af0]' : 'text-gray-400 hover:text-white'}`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:max-w-xs">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none" />
          <Input
            type="text"
            placeholder="Search posts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 w-full"
          />
        </div>
      </div>

      {loading && (
        <div className="flex justify-center items-center h-64">
          <Spinner className="w-8 h-8 text-[#7f5af0]" />
        </div>
      )}
      {error && <p className="text-center text-red-500">{error}</p>}
      
      {!loading && !error && (
        <>
          {filteredPosts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPosts.map(post => (
                <Card key={post.path} className="p-5 flex flex-col justify-between hover:border-[#7f5af0]/50 hover:-translate-y-1">
                  <div>
                    <div className="flex justify-between items-start">
                      <h2 className="text-lg font-bold text-white mb-2">{post.frontMatter.title}</h2>
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${post.frontMatter.published ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                        {post.frontMatter.published ? 'Published' : 'Draft'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 mb-4 line-clamp-2">{post.frontMatter.description}</p>
                    <div className="text-xs text-gray-500 mb-4">
                      {(() => {
                        if (!post.frontMatter.date) return 'No Date';
                        const date = new Date(post.frontMatter.date);
                        // Validate date before formatting to prevent "Invalid time value" RangeError.
                        if (isNaN(date.getTime())) {
                            return post.frontMatter.date; // Show original string if invalid
                        }
                        return format(date, 'MMMM d, yyyy');
                      })()}
                    </div>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {post.frontMatter.tags.map(tag => <span key={tag} className="text-xs bg-gray-700/50 px-2 py-1 rounded">{tag}</span>)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-auto pt-4 border-t border-white/10">
                    <Button onClick={() => onEditPost(post)} variant="secondary" size="sm" className="gap-2 flex-grow">
                      <EditIcon className="w-4 h-4" /> Edit
                    </Button>
                    <Button onClick={() => handleDelete(post)} variant="danger-ghost" size="icon">
                      <TrashIcon className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-gray-400">No posts found.</p>
              {searchQuery && <p className="text-sm text-gray-500 mt-2">Try adjusting your search query or filters.</p>}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Dashboard;