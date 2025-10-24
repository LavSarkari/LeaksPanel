
export interface AuthDetails {
  token: string;
  owner: string;
  repo: string;
}

export interface FrontMatter {
  title: string;
  date: string;
  categories: string[];
  tags: string[];
  description: string;
  image?: {
    path: string;
    alt: string;
  };
  published: boolean;
  layout: 'post';
}

export interface Post {
  sha?: string;
  fileName: string;
  path: string;
  frontMatter: FrontMatter;
  content: string;
  isDraft?: boolean;
}

export interface UnsavedPost extends Omit<Post, 'fileName' | 'path'> {
    id: string; // To identify draft in localStorage
    fileName?: string;
    path?: string;
}
