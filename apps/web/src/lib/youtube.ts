let apiPromise: Promise<typeof YT> | null = null;

declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
    YT: typeof YT;
  }
}

export function loadYouTubeIframeAPI(): Promise<typeof YT> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('window is not defined'));
  }

  if (window.YT && window.YT.Player) {
    return Promise.resolve(window.YT);
  }

  if (!apiPromise) {
    apiPromise = new Promise((resolve) => {
      const scriptId = 'youtube-iframe-api';
      if (!document.getElementById(scriptId)) {
        const script = document.createElement('script');
        script.id = scriptId;
        script.src = 'https://www.youtube.com/iframe_api';
        script.async = true;
        document.head.appendChild(script);
      }

      window.onYouTubeIframeAPIReady = () => {
        resolve(window.YT);
      };
    });
  }

  return apiPromise;
}
