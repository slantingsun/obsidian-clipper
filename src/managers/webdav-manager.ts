import browser from '../utils/browser-polyfill';

export class WebDavManager {
    private url: string;
    private username?: string;
    private password?: string;

    constructor(url: string, username?: string, password?: string) {
        // Ensure URL ends with / if it's a directory path, but users might provide full path to file
        // For sync, we probably want a base directory.
        // Let's assume user provides the base WebDAV URL.
        this.url = url.endsWith('/') ? url : url + '/';
        this.username = username;
        this.password = password;
    }

    private getHeaders(): HeadersInit {
        const headers: any = {};
        if (this.username && this.password) {
            headers['Authorization'] = 'Basic ' + btoa(unescape(encodeURIComponent(this.username + ':' + this.password)));
        }
        return headers;
    }

    async testConnection(): Promise<{ success: boolean; message?: string }> {
        try {
            // PROPFIND is standard for checking WebDAV existence/auth
            const response = await fetch(this.url, {
                method: 'PROPFIND',
                headers: {
                    ...this.getHeaders(),
                    'Depth': '0'
                }
            });
            
            if (response.ok || response.status === 207) {
                return { success: true };
            } else if (response.status === 401) {
                return { success: false, message: 'Authentication failed' };
            } else {
                 // Try GET as fallback if PROPFIND is blocked
                 try {
                     const getResponse = await fetch(this.url, {
                        method: 'GET',
                        headers: this.getHeaders()
                     });
                     if (getResponse.ok || getResponse.status === 404) { // 404 means auth ok, just no index
                         return { success: true };
                     }
                 } catch (e) {}
                 
                return { success: false, message: `Server returned ${response.status} ${response.statusText}` };
            }
        } catch (error) {
            return { success: false, message: error instanceof Error ? error.message : String(error) };
        }
    }

    async upload(fileName: string, content: string): Promise<void> {
        const fullUrl = this.url + fileName;
        const response = await fetch(fullUrl, {
            method: 'PUT',
            headers: {
                ...this.getHeaders(),
                'Content-Type': 'application/json'
            },
            body: content
        });
        
        if (!response.ok) {
            throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
        }
    }

    async download(fileName: string): Promise<string> {
        const fullUrl = this.url + fileName;
        const response = await fetch(fullUrl, {
            method: 'GET',
            headers: this.getHeaders()
        });
        
        if (!response.ok) {
            throw new Error(`Download failed: ${response.status} ${response.statusText}`);
        }
        return await response.text();
    }
}
