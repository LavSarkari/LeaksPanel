// You need to install these packages: `npm install octokit gray-matter`
import { Octokit } from 'octokit';
import matter from 'gray-matter';
import { AuthDetails, Post, FrontMatter } from '../types';

function b64Encode(str: string): string {
    return btoa(unescape(encodeURIComponent(str)));
}

function b64Decode(str: string): string {
    return decodeURIComponent(escape(atob(str)));
}

async function getOctokit(token: string) {
    return new Octokit({ auth: token });
}

export async function getPosts(auth: AuthDetails): Promise<Post[]> {
    const octokit = await getOctokit(auth.token);
    try {
        const { data } = await octokit.rest.repos.getContent({
            owner: auth.owner,
            repo: auth.repo,
            path: '_posts',
        });

        if (!Array.isArray(data)) {
            return [];
        }

        const postPromises = data.map(async (file) => {
            try {
                const postContent = await getPostContent(auth, file.path);
                if (postContent) {
                    return postContent;
                }
                return null;
            } catch (e) {
                console.error(`Failed to fetch or parse ${file.path}`, e);
                return null;
            }
        });

        const posts = (await Promise.all(postPromises)).filter((p): p is Post => p !== null);
        
        return posts.sort((a, b) => {
            const dateA = a.frontMatter.date ? new Date(a.frontMatter.date).getTime() : 0;
            const dateB = b.frontMatter.date ? new Date(b.frontMatter.date).getTime() : 0;
            // An invalid date results in NaN. Default NaN to 0 to avoid sorting errors and crashes.
            return (isNaN(dateB) ? 0 : dateB) - (isNaN(dateA) ? 0 : dateA);
        });

    } catch (error: unknown) {
        console.error("Error fetching posts:", error);
        // Check if the error is an object with a status property equal to 404
        if (error && typeof error === 'object' && 'status' in error && (error as { status: number }).status === 404) {
            // This is expected if the _posts directory doesn't exist yet.
            // Return an empty array and let the user create their first post.
            return [];
        }
        // For all other errors, re-throw to be caught by the UI.
        throw error;
    }
}

export async function getPostContent(auth: AuthDetails, path: string): Promise<Post | null> {
    const octokit = await getOctokit(auth.token);
    const { data } = await octokit.rest.repos.getContent({
        owner: auth.owner,
        repo: auth.repo,
        path,
    });

    if ('content' in data) {
        const fileContent = b64Decode(data.content);
        const { data: frontMatter, content } = matter(fileContent);

        // Ensure tags and categories are always arrays to prevent .map errors.
        // This handles posts where the front matter might be missing these fields.
        const normalizedFrontMatter = {
            ...frontMatter,
            tags: frontMatter.tags ?? [],
            categories: frontMatter.categories ?? [],
            published: frontMatter.published !== false,
        };

        return {
            sha: data.sha,
            fileName: data.name,
            path: data.path,
            frontMatter: normalizedFrontMatter as FrontMatter,
            content: content.trim(),
        };
    }
    return null;
}

export async function createOrUpdatePost(auth: AuthDetails, post: Post, commitMessage: string): Promise<void> {
    const octokit = await getOctokit(auth.token);
    const fileContent = matter.stringify(post.content, post.frontMatter);
    
    await octokit.rest.repos.createOrUpdateFileContents({
        owner: auth.owner,
        repo: auth.repo,
        path: post.path,
        message: commitMessage,
        content: b64Encode(fileContent),
        sha: post.sha, // If sha is provided, it's an update. If undefined, it's a create.
    });
}

export async function deletePost(auth: AuthDetails, post: Post): Promise<void> {
    if (!post.sha) {
        throw new Error("Cannot delete post without SHA.");
    }
    const octokit = await getOctokit(auth.token);
    await octokit.rest.repos.deleteFile({
        owner: auth.owner,
        repo: auth.repo,
        path: post.path,
        message: `chore: delete post ${post.fileName}`,
        sha: post.sha,
    });
}

export async function uploadImage(auth: AuthDetails, path: string, contentBase64: string): Promise<string> {
    const octokit = await getOctokit(auth.token);
    const { data } = await octokit.rest.repos.createOrUpdateFileContents({
        owner: auth.owner,
        repo: auth.repo,
        path,
        message: `feat: add image ${path.split('/').pop()}`,
        content: contentBase64,
    });
    return data.content?.download_url || '';
}