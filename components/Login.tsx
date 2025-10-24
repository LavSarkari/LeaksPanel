import React, { useState } from 'react';
import { AuthDetails } from '../types';
import Button from './ui/Button';
import Input from './ui/Input';
import Card from './ui/Card';
import { GithubIcon } from '../constants';

interface LoginProps {
  setAuth: (auth: AuthDetails) => void;
  initialError?: string | null;
}

const GITHUB_OWNER = 'LavSarkari';
const GITHUB_REPO = 'leaks';

const Login: React.FC<LoginProps> = ({ setAuth, initialError }) => {
  const [token, setToken] = useState('');
  const [error, setError] = useState(initialError || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!token) {
      setError('Personal Access Token is required.');
      return;
    }
    setAuth({ token, owner: GITHUB_OWNER, repo: GITHUB_REPO });
  };

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Card className="p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-white">LeaksPanel</h1>
          <p className="text-gray-400 mt-2">
            Connecting to <code className="font-mono bg-white/10 px-1 py-0.5 rounded text-gray-200">{GITHUB_OWNER}/{GITHUB_REPO}</code>
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-300" htmlFor="token">GitHub Personal Access Token</label>
            <Input id="token" type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="ghp_..." required />
             <a href="https://github.com/settings/tokens/new?scopes=repo" target="_blank" rel="noopener noreferrer" className="text-xs text-gray-500 hover:text-[#7f5af0] transition-colors mt-1 block">
              Generate a new token with 'repo' scope.
            </a>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="text-xs text-gray-500 bg-gray-800/30 p-2 rounded-md">
            <strong>Security Note:</strong> Your PAT is stored only in your browser's local storage and is never sent anywhere except directly to the GitHub API.
          </div>
          <Button type="submit" className="w-full gap-2" size="lg">
            <GithubIcon className="w-5 h-5"/>
            Connect to GitHub
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default Login;