import { App, AppUrlOpen } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { useNavigate } from "react-router-dom";

export interface DeepLinkParams {
  type: 'book' | 'user' | 'message' | 'club' | 'list';
  id: string;
  conversationId?: string; // For message links
}

class DeepLinkService {
  private navigateCallback: ((path: string, options?: { state?: any }) => void) | null = null;
  private pendingLink: string | null = null;

  /**
   * Initialize the deep link service
   * Should be called once when the app starts
   */
  async initialize(navigate: (path: string, options?: { state?: any }) => void) {
    this.navigateCallback = navigate;

    // Handle pending link if app was opened via deep link
    if (this.pendingLink) {
      this.handleDeepLink(this.pendingLink);
      this.pendingLink = null;
    }

    if (Capacitor.isNativePlatform()) {
      // Listen for app URL open events (native)
      const listener = await App.addListener('appUrlOpen', (event: AppUrlOpen) => {
        console.log('Deep link received:', event.url);
        this.handleDeepLink(event.url);
      });

      return () => {
        listener.remove();
      };
    } else {
      // Web: handle URL changes
      const handleUrlChange = () => {
        const url = window.location.href;
        if (url.includes('brack://') || url.includes('brack.app')) {
          this.handleDeepLink(url);
        }
      };

      // Check initial URL
      handleUrlChange();

      // Listen for hash changes (for web deep links)
      window.addEventListener('hashchange', handleUrlChange);

      return () => {
        window.removeEventListener('hashchange', handleUrlChange);
      };
    }
  }

  /**
   * Parse a deep link URL and extract parameters
   */
  parseDeepLink(url: string): DeepLinkParams | null {
    try {
      // Remove protocol and domain
      let path = url.replace(/^.*?:\/\//, '').replace(/^[^\/]+/, '');
      
      // Handle different URL formats
      // brack://book/123
      // brack://user/456
      // brack://message/789?conversationId=abc
      // https://brack.app/book/123
      // https://brack.app/user/456

      const urlObj = new URL(url.includes('://') ? url : `https://${url}`);
      const pathParts = urlObj.pathname.split('/').filter(Boolean);

      if (pathParts.length < 2) {
        return null;
      }

      const [type, id] = pathParts;
      const conversationId = urlObj.searchParams.get('conversationId') || undefined;

      // Validate type
      if (!['book', 'user', 'message', 'club', 'list'].includes(type)) {
        return null;
      }

      return {
        type: type as DeepLinkParams['type'],
        id,
        conversationId: conversationId || undefined,
      };
    } catch (error) {
      console.error('Error parsing deep link:', error);
      return null;
    }
  }

  /**
   * Handle a deep link URL
   */
  private handleDeepLink(url: string) {
    const params = this.parseDeepLink(url);
    
    if (!params) {
      console.warn('Invalid deep link URL:', url);
      return;
    }

    if (!this.navigateCallback) {
      // Store for later if navigate callback not set yet
      this.pendingLink = url;
      return;
    }

    this.navigateToRoute(params);
  }

  /**
   * Navigate to the appropriate route based on deep link parameters
   */
  private navigateToRoute(params: DeepLinkParams) {
    if (!this.navigateCallback) {
      return;
    }

    let route: string;
    let navigationState: any = undefined;

    switch (params.type) {
      case 'book':
        route = `/book/${params.id}`;
        break;
      case 'user':
        route = `/users/${params.id}`;
        break;
      case 'message':
        route = `/messages`;
        // For messages with conversation ID, we need to pass it via navigation state
        // The Messages component will pick this up from location.state
        if (params.conversationId) {
          navigationState = { conversationId: params.conversationId };
        }
        break;
      case 'club':
        route = `/clubs/${params.id}`;
        break;
      case 'list':
        route = `/lists/${params.id}`;
        break;
      default:
        console.warn('Unknown deep link type:', params.type);
        return;
    }

    console.log('Navigating to:', route, navigationState ? 'with state' : '');
    
    // Use navigate with state if available
    if (navigationState) {
      this.navigateCallback(route, { state: navigationState });
    } else {
      this.navigateCallback(route);
    }
  }

  /**
   * Generate a deep link URL for sharing
   */
  generateDeepLink(params: DeepLinkParams): string {
    const baseUrl = 'brack://';
    let url = `${baseUrl}${params.type}/${params.id}`;
    
    if (params.conversationId) {
      url += `?conversationId=${params.conversationId}`;
    }

    return url;
  }

  /**
   * Generate a web deep link URL for sharing
   */
  generateWebDeepLink(params: DeepLinkParams): string {
    const baseUrl = 'https://brack.app';
    let url = `${baseUrl}/${params.type}/${params.id}`;
    
    if (params.conversationId) {
      url += `?conversationId=${params.conversationId}`;
    }

    return url;
  }
}

export const deepLinkService = new DeepLinkService();
